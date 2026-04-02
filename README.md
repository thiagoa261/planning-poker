# 🃏 Planning Poker

Aplicação web em tempo real para sessões de **Planning Poker**, permitindo que equipes estimem tarefas de forma colaborativa.

## ✨ Funcionalidades

- **Salas em tempo real** — Crie ou entre em salas com código compartilhável
- **Votação** — Escala padrão com opção de abstenção
- **Votos ocultos** — Votos permanecem escondidos até o admin revelar
- **Estatísticas** — Média, mediana calculadas ao revelar os votos
- **Transferência de admin** — Passe o controle da sala para outro participante
- **Emojis interativos** — Lance emojis para outros participantes 🎉

## 🛠️ Tech Stack

| Camada     | Tecnologia                                      |
| ---------- | ------------------------------------------------ |
| Frontend   | **Nuxt 4**, Nuxt UI, TailwindCSS 4, Vue 3       |
| Backend    | **NestJS**, Socket.IO, JWT                       |
| Banco      | **Redis** (armazenamento de salas)               |
| Runtime    | **Bun**                                          |
| Deploy     | **Docker**                                       |

## 📁 Estrutura do Projeto

```
planning-poker/
├── api/                  # 🛠️ Backend (NestJS)
│   ├── src/
│   │   ├── room/         # 🌐 Gateway WebSocket + service de salas
│   │   ├── session/      # 🔐 Autenticação JWT
│   │   └── types/        # 📦 Interfaces e enums
│   ├── Dockerfile        # 🐳 Dockerfile da API
│   └── package.json      # 📦 Dependências da API
├── app/                  # 💻 Frontend (Nuxt 4)
│   ├── app/
│   │   ├── pages/        # 🗂️ Páginas (home + sala)
│   │   ├── composables/  # 🔌 useSocket
│   │   └── types/        # 🧩 Tipos compartilhados
│   ├── Dockerfile        # 🐳 Dockerfile do Frontend
│   └── package.json      # 📦 Dependências do Frontend
├── docker-compose.yml    # 🔧 Orquestração Docker Compose
└── .env.example          # 🧩 Exemplo de variáveis de ambiente
```

## 🚀 Começando

### Pré-requisitos

- [Bun](https://bun.sh/) >= 1.3
- [Redis](https://redis.io/) (local ou remoto)
- [Docker](https://www.docker.com/) (opcional, para deploy)

### Variáveis de Ambiente

**Raiz** (`.env`):

```env
APP_PORT=3000
API_PORT=3001
```

**API** (`api/.env`):

```env
PORT=3001
REDIS_PREFIX="pp"
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_PASSWORD=""
JWT_SECRET="sua-chave-secreta"
```

**App** (`app/.env`):

```env
NUXT_PUBLIC_API_URL="http://localhost:3001"
```

### Instalação Local

```bash
# API
cd api
bun install
bun start:dev

# APP
cd app
bun install
bun dev
```

### Docker

```bash
# Na raiz do projeto
docker compose up --build
```

## 📡 Eventos WebSocket

| Evento              | Direção        | Descrição                          |
| ------------------- | -------------- | ---------------------------------- |
| `room:create`       | Cliente → API  | Cria uma nova sala                 |
| `room:join`         | Cliente → API  | Entra em uma sala existente        |
| `room:reconnect`    | Cliente → API  | Reconecta à sala com token JWT     |
| `room:state`        | API → Cliente  | Estado atualizado da sala          |
| `vote:start`        | Cliente → API  | Inicia uma rodada de votação       |
| `vote:cast`         | Cliente → API  | Envia um voto                      |
| `vote:reveal`       | Cliente → API  | Revela todos os votos              |
| `vote:end`          | Cliente → API  | Encerra a rodada                   |
| `user:setSpectator` | Cliente → API  | Alterna modo espectador            |
| `admin:grant`       | Cliente → API  | Transfere admin para outro usuário |
| `emoji:throw`       | Cliente → API  | Lança emoji para um participante   |
