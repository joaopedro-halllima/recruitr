up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

ps:
	docker compose ps

db:
	docker compose exec db psql -U recruitr -d recruitr

