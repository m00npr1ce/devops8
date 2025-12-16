## TODO приложение на Kubernetes с MongoDB и CI/CD

Простой REST API для списка дел (без аутентификации) на Node.js + Express + MongoDB, упакованный в Docker и развёртываемый в Kubernetes. Конвейер CI/CD реализован на GitHub Actions.

### 1. Функционал приложения

- **GET `/todos`**: получить все задачи
- **POST `/todos`**: создать новую задачу  
  - Пример тела:  
    ```json
    { "title": "Купить молоко", "description": "До 18:00", "completed": false }
    ```
- **GET `/todos/:id`**: получить задачу по `id`
- **PUT `/todos/:id`**: обновить задачу по `id`
- **DELETE `/todos/:id`**: удалить задачу по `id`

Дополнительно:

- **GET `/health`**: проверка состояния сервиса.

Данные хранятся в MongoDB в базе `todos_db`, коллекция `todos`.

### 2. Локальный запуск без Kubernetes

1. **Установить зависимости**
   ```bash
   npm install
   ```
2. **Запустить MongoDB локально** (по умолчанию ожидается `mongodb://localhost:27017/todos_db`) или задать переменную окружения:
   ```bash
   set MONGO_URI=mongodb://localhost:27017/todos_db   # Windows PowerShell/cmd
   # или
   export MONGO_URI=mongodb://localhost:27017/todos_db
   ```
3. **Запустить приложение**
   ```bash
   npm start
   ```
4. **Проверить эндпоинты**:
   - `GET http://localhost:3000/health`
   - `GET http://localhost:3000/todos`

### 3. Сборка Docker-образа

```bash
docker build -t k8s-todo-app:local .
```

Запуск контейнера (с отдельным контейнером MongoDB):

```bash
# MongoDB
docker run -d --name mongo -p 27017:27017 mongo:7

# Приложение
docker run -d --name todo-app -p 3000:3000 ^
  -e MONGO_URI=mongodb://host.docker.internal:27017/todos_db ^
  k8s-todo-app:local
```

### 4. Настройка локального кластера Kubernetes (Minikube)

1. **Установить Minikube** (Windows): скачать с сайта Kubernetes / Minikube и добавить в PATH.
2. **Запустить кластер**
   ```bash
   minikube start
   ```
3. **Проверить подключение**
   ```bash
   kubectl get nodes
   ```

### 5. Деплой MongoDB в Kubernetes

Манифест: `k8s/mongo-deployment.yaml`

Применение:

```bash
kubectl apply -f k8s/mongo-deployment.yaml
kubectl get pods
kubectl get svc
```

MongoDB разворачивается как Deployment с сервисом `mongo` на порту `27017`. Приложение подключается к `mongodb://mongo:27017/todos_db`.

### 6. Деплой приложения TODO в Kubernetes

1. **Собрать и запушить образ в Docker Hub (один раз вручную)**:

   ```bash
   docker login
   docker build -t docker.io/YOUR_DOCKERHUB_USERNAME/k8s-todo-app:latest .
   docker push docker.io/YOUR_DOCKERHUB_USERNAME/k8s-todo-app:latest
   ```

2. **Обновить манифест приложения `k8s/app-deployment.yaml`**

   - Замените `YOUR_DOCKERHUB_USERNAME` на ваш логин Docker Hub.

3. **Применить манифесты**

   ```bash
   kubectl apply -f k8s/app-deployment.yaml
   ```

4. **Проверить ресурсы**

   ```bash
   kubectl get pods
   kubectl get svc
   ```

   Сервис `todo-app` создаётся с типом `NodePort` и проксирует трафик на контейнерный порт `3000`.

5. **Доступ к приложению через Minikube**

   ```bash
   minikube service todo-app --url
   ```

   Команда вернёт URL вида:  
   `http://192.168.49.2:30415` — используйте его для запросов:

   - `GET {URL}/health`
   - `GET {URL}/todos`
   - `POST {URL}/todos`

### 7. Тестирование CRUD и сохранения данных в MongoDB

После запуска приложения в кластере:

- **Создать задачу**

  ```bash
  curl -X POST {URL}/todos ^
    -H "Content-Type: application/json" ^
    -d "{\"title\":\"Первая задача\",\"description\":\"Проверка CRUD\",\"completed\":false}"
  ```

- **Прочитать все задачи**

  ```bash
  curl {URL}/todos
  ```

- **Прочитать задачу по id**

  ```bash
  curl {URL}/todos/ID_ЗАДАЧИ
  ```

- **Обновить задачу**

  ```bash
  curl -X PUT {URL}/todos/ID_ЗАДАЧИ ^
    -H "Content-Type: application/json" ^
    -d "{\"title\":\"Обновлённая задача\",\"description\":\"Обновлено\",\"completed\":true}"
  ```

- **Удалить задачу**

  ```bash
  curl -X DELETE {URL}/todos/ID_ЗАДАЧИ
  ```

Если после перезапуска подов приложения задачи сохраняются, значит данные действительно лежат в MongoDB (для production вместо `emptyDir` в `mongo-deployment.yaml` следует использовать PersistentVolumeClaim).

### 8. CI/CD с GitHub Actions

Workflow: `.github/workflows/cicd.yaml`

Выполняет:

- установку Node.js и зависимостей;
- запуск простого smoke-теста;
- сборку Docker-образа;
- пуш образа в Docker Hub;
- деплой в Kubernetes кластер.

#### Настройка секретов в GitHub

В репозитории GitHub создайте **Settings → Secrets and variables → Actions**:

- **`DOCKERHUB_USERNAME`**: ваш логин Docker Hub;
- **`DOCKERHUB_TOKEN`**: токен/пароль Docker Hub для push;
- **`KUBE_CONFIG`**: содержимое kubeconfig кластера (например, скопированное из `~/.kube/config`).

После этого при push в ветку `main` workflow автоматически:

1. соберёт и запушит образ `docker.io/$DOCKERHUB_USERNAME/k8s-todo-app`;
2. применит манифесты `k8s/app-deployment.yaml` и `k8s/mongo-deployment.yaml`;
3. дождётся успешного `rollout` для Deployment-ов.

### 9. Минимальная проверка через встроенный smoke-тест

При локальном запуске (без Kubernetes) можно запустить smoke-тест:

1. Запустить MongoDB и приложение (`npm start`).
2. В другом терминале:
   ```bash
   npm test
   ```

Тест создаст задачу, прочитает её, обновит и удалит, выводя статусы в консоль.


