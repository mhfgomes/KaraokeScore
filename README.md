# KaraokeScore

Plataforma interna de registo e votação de karaoke (Next.js + TypeScript + Prisma/SQLite + SSE).

## Instalação (uma vez, com internet)

```bash
bun install
cp .env.example .env      # editar ADMIN_USERNAME / ADMIN_PASSWORD
bun run setup             # cria a base de dados e o admin inicial
bun run build
```

## Arrancar

```bash
bun run start             # escuta só em 127.0.0.1:3000 — o acesso é pelo nginx
```

O acesso é feito pelo nginx (ver `deploy/nginx.conf`), que:
- só aceita a rede interna (IPs privados);
- envia o IP real do cliente em `X-Real-IP` (usado no limite de 1 voto por IP);
- desliga o buffering em `/api/events` (SSE).

O domínio interno (ex.: `karaoke.local`) tem de resolver para o IP fixo do PC no DNS da rede
(router/Pi-hole). Definir `PUBLIC_URL` com esse domínio para os QR codes.

| Página            | Para quem                                   |
| ----------------- | ------------------------------------------- |
| `/`               | Público (via QR)                            |
| `/registo`        | Inscrição dos concorrentes                  |
| `/votar`          | Votação do público                          |
| `/classificacoes` | Classificação da noite e mensal             |
| `/ao-vivo`        | Telão (abrir em ecrã inteiro no PC/TV)      |
| `/admin`          | Gestão da noite, da fila e dos admins       |

## Fluxo de uma noite

1. Admin → **Abrir nova noite**: inscrições abertas (QR no telão).
2. Admin gere a fila (**Próximo a cantar**, 🎤, **Não compareceu**).
3. Admin → **Abrir votação**: inscrições fecham; o público vota (1 voto por dispositivo).
   O telão mostra a distribuição em barras anónimas.
4. Admin → **Fechar votação**: 1.º = 3 pts, 2.º = 2 pts, 3.º = 1 pt (empates partilham o lugar: 1, 1, 3).
   Mensal = soma dos pontos por telefone; desempate por nº de 1.os lugares e depois votos.

## Variáveis (.env)

| Variável          | Descrição                                                         |
| ----------------- | ----------------------------------------------------------------- |
| `DATABASE_URL`    | Ficheiro SQLite (backup = copiar este ficheiro)                   |
| `ADMIN_USERNAME`  | Admin inicial criado por `bun run db:seed`                        |
| `ADMIN_PASSWORD`  | Password do admin inicial                                         |
| `ONE_VOTE_PER_IP` | `true` (padrão) também limita a 1 voto por IP                     |
| `PUBLIC_URL`      | URL usado nos QR (ex.: `http://karaoke.local`)                    |
| `PORT`            | Porta (padrão 3000)                                               |
| `ALLOW_EXTERNAL`  | `true` desativa o bloqueio de rede interna (não recomendado)      |

## Docker

Imagem para `linux/amd64` e `linux/arm64` (PC normal ou Raspberry Pi 4/5).
A base de dados fica no volume `karaoke-data`. No arranque, o contentor aplica as
migrações e cria o admin inicial (`ADMIN_USERNAME`/`ADMIN_PASSWORD`) se ainda não
existir nenhum.

```bash
cp .env.example .env   # define ADMIN_PASSWORD e PUBLIC_URL

# Sem nginx: app diretamente na porta 3000 (APP_PORT para mudar)
docker compose up -d --build

# Com nginx: só o nginx fica exposto, na porta 80 (HTTP_PORT para mudar)
docker compose -f compose.nginx.yaml up -d --build

# Atualizar (os dados mantêm-se)
git pull && docker compose up -d --build
```

- **`PUBLIC_URL` é obrigatório** em Docker: dentro do contentor a app não sabe o
  IP do PC na rede, por isso os QR codes usariam um endereço errado.
- Nas duas variantes o IP do cliente vem da ligação e não de um cabeçalho que o
  cliente consiga falsificar: no compose sem nginx há um mini proxy interno
  (`docker/edge.mjs`) que faz o mesmo que o nginx.
- No **Docker Desktop (macOS/Windows)** todos os pedidos chegam com o mesmo IP
  interno. Aí convém `ONE_VOTE_PER_IP="false"`, senão só passa um voto por noite.
  Em Linux (incluindo o Raspberry Pi) o IP real é preservado.
- Backup: `docker compose cp app:/data/karaoke.db ./backup.db`.
- Imagens no Docker Hub (amd64 + arm64, cada uma compilada nativamente):
  tag `v1.2.3` → `:v1.2.3` e `:latest` (`release.yml`); todas as noites →
  `:nightly` (`nightly.yml`). Ambas correm o CI completo antes de publicar.
  Para usar a imagem publicada, troca `build: .` por
  `image: <utilizador>/karaokescore:latest` no compose.
- Imagem para as duas arquiteturas (por exemplo, para publicar num registo):
  `docker buildx build --platform linux/amd64,linux/arm64 -t karaokescore .`

## Testes e CI

```bash
bun run test      # testes unitários (não confundir com `bun test`, o runner do bun) (pontuação, telefones, preços, IPs, datas)
bun run test:api  # testes de API: precisam de `bun run build` antes
bun run test:all  # build + todos os testes
bun run typecheck
```

Os testes de API arrancam a app compilada numa base de dados SQLite temporária
(nunca tocam em `prisma/karaoke.db`) e percorrem uma noite completa: inscrições,
fila, votação, empates, pontos, votação temporizada, CSRF e acesso só pela rede
interna.

O GitHub Actions (`.github/workflows/ci.yml`) corre lint, tipos, testes
unitários, build e testes de API em cada push e pull request, e testa a
imagem Docker (arranque, migrações, login). O Dependabot
propõe atualizações semanais das dependências.

## Licença

[MIT](LICENSE) © 2026 Mário Gomes
