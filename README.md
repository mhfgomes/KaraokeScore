# Karaoke Vote

Plataforma interna de registo e votação de karaoke (Next.js + TypeScript + Prisma/SQLite + SSE).

## Instalação (uma vez, com internet)

```bash
npm install
cp .env.example .env      # editar ADMIN_USERNAME / ADMIN_PASSWORD
npm run setup             # cria a base de dados e o admin inicial
npm run build
```

## Arrancar

```bash
npm start                 # escuta só em 127.0.0.1:3000 — o acesso é pelo nginx
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
| `ADMIN_USERNAME`  | Admin inicial criado por `npm run db:seed`                        |
| `ADMIN_PASSWORD`  | Password do admin inicial                                         |
| `ONE_VOTE_PER_IP` | `true` (padrão) também limita a 1 voto por IP                     |
| `PUBLIC_URL`      | URL usado nos QR (ex.: `http://karaoke.local`)                    |
| `PORT`            | Porta (padrão 3000)                                               |
| `ALLOW_EXTERNAL`  | `true` desativa o bloqueio de rede interna (não recomendado)      |

## Licença

[MIT](LICENSE) © 2026 Mário Gomes
