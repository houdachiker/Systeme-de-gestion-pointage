# Pointage App — Spring Boot + React JS

## Structure du projet
```
pointage-app/
├── backend/      → Spring Boot (port 8080)
└── frontend/     → React JS   (port 3000)
```

---

## 1. Configuration MongoDB

Dans `backend/src/main/resources/application.properties` :
Remplacer `USERNAME` et `PASSWORD` par vos identifiants MongoDB Atlas.

---

## 2. Lancer le Backend (Spring Boot)

```bash
cd backend
./mvnw spring-boot:run
```
> Serveur démarré sur http://localhost:8080

---

## 3. Lancer le Frontend (React)

```bash
cd frontend
npm install
npm start
```
> Application ouverte sur http://localhost:3000

---

## 4. Tester les API (Thunder Client dans VS Code)

| Méthode | URL | Body |
|---------|-----|------|
| POST | /api/auth/register | { "nom":"Ali", "email":"ali@test.com", "password":"123456", "role":"ADMIN" } |
| POST | /api/auth/login | { "email":"ali@test.com", "password":"123456" } |
| POST | /api/pointage | { "userId":"...", "type":"ENTREE", "latitude":"33.5", "longitude":"-7.6" } |
| GET  | /api/pointage/today | — |
| POST | /api/conge | { "userId":"...", "dateDebut":"2026-06-01", "dateFin":"2026-06-05", "type":"ANNUEL" } |

---

## Rôles

- **ADMIN** → accès Dashboard, gestion employés et congés
- **EMPLOYE** → pointer, voir son historique, demander des congés
