package com.pointage.controller;

import com.pointage.model.Conge;
import com.pointage.model.Pointage;
import com.pointage.model.QRCode;
import com.pointage.model.User;
import java.time.format.DateTimeParseException;
import com.pointage.repository.CongeRepository;
import com.pointage.repository.PointageRepository;
import com.pointage.repository.QRCodeRepository;
import com.pointage.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/pointage")
@RequiredArgsConstructor
public class PointageController {

    private final PointageRepository pointageRepository;
    private final QRCodeRepository qrCodeRepository;
    private final UserRepository userRepository;
    private final CongeRepository congeRepository;

    private static final List<String> WEEK_LABELS = List.of("Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam");

    // POST /api/pointage - Pointage authentifié (JWT requis)
    @PostMapping
    public ResponseEntity<?> enregistrer(@RequestBody Pointage pointage) {
        if (pointage.getQrCode() != null && !pointage.getQrCode().isEmpty()) {
            Optional<QRCode> qrOpt = qrCodeRepository.findByValeur(pointage.getQrCode())
                    .filter(qr -> Boolean.TRUE.equals(qr.getActif())
                            && qr.getDateExpiration() != null
                            && qr.getDateExpiration().isAfter(LocalDateTime.now()));
            if (qrOpt.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("message", "QR code invalide ou expiré."));
            }
            pointage.setQrCodeId(qrOpt.get().getId());
        }
        if (pointage.getModeTravail() == null || pointage.getModeTravail().isEmpty()) {
            pointage.setModeTravail("PRESENTIEL");
        }
        pointage.setDate(LocalDate.now());
        pointage.setHeure(LocalTime.now());
        pointage.setValide(true);
        return ResponseEntity.ok(pointageRepository.save(pointage));
    }

    // POST /api/pointage/scan - Pointage public via QR URL (sans JWT)
    @PostMapping("/scan")
    public ResponseEntity<?> scanPointage(@RequestBody Map<String, String> body) {
        String token = body.get("token");
        String userId = body.get("userId");
        String type = body.get("type");

        if (token == null || userId == null || type == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Données manquantes (token, userId, type requis)."));
        }

        Optional<QRCode> qrOpt = qrCodeRepository.findByValeur(token)
                .filter(qr -> Boolean.TRUE.equals(qr.getActif())
                        && qr.getDateExpiration() != null
                        && qr.getDateExpiration().isAfter(LocalDateTime.now()));

        if (qrOpt.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "QR code invalide ou expiré."));
        }

        Pointage pointage = new Pointage();
        pointage.setUserId(userId);
        pointage.setType(type);
        pointage.setLatitude(body.get("latitude"));
        pointage.setLongitude(body.get("longitude"));
        pointage.setModeTravail(body.getOrDefault("modeTravail", "PRESENTIEL"));
        pointage.setQrCode(token);
        pointage.setQrCodeId(qrOpt.get().getId());
        pointage.setDate(LocalDate.now());
        pointage.setHeure(LocalTime.now());
        pointage.setValide(true);

        return ResponseEntity.ok(pointageRepository.save(pointage));
    }

    // GET /api/pointage/user/{userId}
    @GetMapping("/user/{userId}")
    public ResponseEntity<List<Pointage>> getByUser(@PathVariable String userId) {
        return ResponseEntity.ok(pointageRepository.findByUserId(userId));
    }

    // GET /api/pointage/today - liste brute
    @GetMapping("/today")
    public ResponseEntity<?> getToday(@RequestParam(required = false) String date) {
        try {
            return ResponseEntity.ok(pointageRepository.findByDate(resolveTargetDate(date)));
        } catch (DateTimeParseException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", "Date invalide"));
        }
    }

    // GET /api/pointage/today/enrichi - une ligne par employé avec nom, dept, heures
    @GetMapping("/today/enrichi")
    public ResponseEntity<?> getTodayEnrichi(@RequestParam(required = false) String date) {
        try {
            LocalDate targetDate = resolveTargetDate(date);
            List<Pointage> pointages = pointageRepository.findByDate(targetDate);

        // Grouper par userId
        Map<String, List<Pointage>> byUser = pointages.stream()
                .collect(Collectors.groupingBy(Pointage::getUserId));

        List<Map<String, Object>> result = new ArrayList<>();

        for (Map.Entry<String, List<Pointage>> entry : byUser.entrySet()) {
            String userId = entry.getKey();
            List<Pointage> userPointages = entry.getValue();

            Optional<User> userOpt = userRepository.findById(userId);
            String nom = userOpt.map(User::getNom).orElse(userId);
            String departement = userOpt.map(User::getDepartement).orElse("-");
            String matricule = userOpt.map(User::getMatricule).orElse("-");

            Optional<Pointage> entree = userPointages.stream()
                    .filter(p -> "ENTREE".equals(p.getType()))
                    .min(Comparator.comparing(Pointage::getHeure));

            Optional<Pointage> sortie = userPointages.stream()
                    .filter(p -> "SORTIE".equals(p.getType()))
                    .max(Comparator.comparing(Pointage::getHeure));

            String heuresTravaillees = "-";
            if (entree.isPresent() && sortie.isPresent()) {
                long totalSeconds = Duration.between(entree.get().getHeure(), sortie.get().getHeure()).getSeconds();
                if (totalSeconds > 0) {
                    long h = totalSeconds / 3600;
                    long m = (totalSeconds % 3600) / 60;
                    long sec = totalSeconds % 60;
                    if (h > 0) {
                        heuresTravaillees = String.format("%dh%02d", h, m);
                    } else if (m > 0) {
                        heuresTravaillees = String.format("%d min", m);
                    } else {
                        heuresTravaillees = String.format("%d sec", sec);
                    }
                }
            }

            String modeTravail = entree.map(p ->
                    p.getModeTravail() != null && !p.getModeTravail().isEmpty()
                            ? p.getModeTravail() : "PRESENTIEL"
            ).orElse("PRESENTIEL");

            Map<String, Object> row = new HashMap<>();
            row.put("userId", userId);
            row.put("nom", nom);
            row.put("departement", departement);
            row.put("matricule", matricule);
            row.put("date", targetDate.toString());
            row.put("heureEntree", entree.map(p -> p.getHeure().toString()).orElse(null));
            row.put("heureSortie", sortie.map(p -> p.getHeure().toString()).orElse(null));
            row.put("heuresTravaillees", heuresTravaillees);
            row.put("modeTravail", modeTravail);
            row.put("latitude", entree.map(Pointage::getLatitude).orElse(null));
            row.put("longitude", entree.map(Pointage::getLongitude).orElse(null));

            result.add(row);
        }

        // Trier par nom
        result.sort(Comparator.comparing(r -> (String) r.get("nom")));
        return ResponseEntity.ok(result);
        } catch (DateTimeParseException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", "Date invalide"));
        }
    }

    private LocalDate resolveTargetDate(String date) {
        if (date == null || date.isBlank()) {
            return LocalDate.now();
        }
        return LocalDate.parse(date);
    }

    // GET /api/pointage/stats
    @GetMapping("/stats")
    public ResponseEntity<?> getStats(@RequestParam(required = false) String date) {
        try {
            LocalDate targetDate = resolveTargetDate(date);
            long total = pointageRepository.count();
            List<Pointage> todayPointages = pointageRepository.findByDate(targetDate);

        // Employés distincts ayant pointé (ENTREE) aujourd'hui
        Set<String> presentIds = todayPointages.stream()
                .filter(p -> "ENTREE".equals(p.getType()))
                .map(Pointage::getUserId)
                .collect(Collectors.toSet());

        // Parmi eux, ceux en télétravail
        long teletravailCount = todayPointages.stream()
                .filter(p -> "ENTREE".equals(p.getType()) && "TELETRAVAIL".equals(p.getModeTravail()))
                .map(Pointage::getUserId)
                .distinct()
                .count();

        long totalEmployes = userRepository.countByRole("EMPLOYE");

        // Employés en congé validé aujourd'hui
            long congeAujourdhuiCount = congeRepository.findByStatut("VALIDE").stream()
                .filter(c -> c.getDateDebut() != null && c.getDateFin() != null
                    && !targetDate.isBefore(c.getDateDebut())
                    && !targetDate.isAfter(c.getDateFin()))
                .map(Conge::getUserId)
                .distinct()
                .count();

        // Absents = employés sans pointage et sans congé validé aujourd'hui
        long absents = Math.max(0, totalEmployes - presentIds.size() - congeAujourdhuiCount);

            return ResponseEntity.ok(Map.of(
                    "total", total,
                    "today", (long) presentIds.size(),
                    "teletravail", teletravailCount,
                    "totalEmployes", totalEmployes,
                    "congesAujourdhui", congeAujourdhuiCount,
                    "absents", absents
            ));
        } catch (DateTimeParseException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", "Date invalide"));
        }
    }

    // GET /api/pointage/week - présents vs absents pour la semaine courante (Dim->Sam)
    @GetMapping("/week")
    public ResponseEntity<?> getWeekStats() {
        LocalDate today = LocalDate.now();
        LocalDate weekStart = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.SUNDAY));
        long totalEmployes = userRepository.countByRole("EMPLOYE");

        List<Map<String, Object>> result = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            LocalDate date = weekStart.plusDays(i);
            List<Pointage> dayPointages = pointageRepository.findByDate(date);
            long presents = dayPointages.stream()
                    .filter(p -> "ENTREE".equals(p.getType()))
                    .map(Pointage::getUserId)
                    .distinct()
                    .count();

            long absents = Math.max(0, totalEmployes - presents);

            result.add(Map.of(
                    "day", WEEK_LABELS.get(i),
                    "present", presents,
                    "absent", absents
            ));
        }

        return ResponseEntity.ok(result);
    }
}
