package com.pointage.controller;

import com.pointage.model.Conge;
import com.pointage.repository.CongeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/conge")
@RequiredArgsConstructor
public class CongeController {

    private final CongeRepository congeRepository;

    // POST /api/conge  — soumettre une demande
    @PostMapping
    public ResponseEntity<?> soumettre(@RequestBody Conge conge) {
        if (conge.getUserId() == null || conge.getDateDebut() == null || conge.getDateFin() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Données incomplètes."));
        }
        if (conge.getDateFin().isBefore(conge.getDateDebut())) {
            return ResponseEntity.badRequest().body(Map.of("message", "La date de fin doit être après la date de début."));
        }

        boolean overlap = congeRepository.findByUserId(conge.getUserId()).stream()
                .filter(c -> !"REFUSE".equals(c.getStatut()))
                .anyMatch(c -> datesOverlap(conge.getDateDebut(), conge.getDateFin(), c.getDateDebut(), c.getDateFin()));

        if (overlap) {
            return ResponseEntity.badRequest().body(Map.of("message", "Vous avez déjà une demande sur cette période."));
        }

        conge.setStatut("EN_ATTENTE");
        Conge saved = congeRepository.save(conge);
        return ResponseEntity.ok(saved);
    }

    // GET /api/conge  — admin : voir toutes les demandes
    @GetMapping
    public ResponseEntity<List<Conge>> getAll() {
        return ResponseEntity.ok(congeRepository.findAll());
    }

    // GET /api/conge/user/{userId}
    @GetMapping("/user/{userId}")
    public ResponseEntity<List<Conge>> getByUser(@PathVariable String userId) {
        return ResponseEntity.ok(congeRepository.findByUserId(userId));
    }

    // GET /api/conge/pending  — admin : voir les demandes en attente
    @GetMapping("/pending")
    public ResponseEntity<List<Conge>> getPending() {
        return ResponseEntity.ok(congeRepository.findByStatut("EN_ATTENTE"));
    }

    // PUT /api/conge/{id}/valider  — admin : valider
    @PutMapping("/{id}/valider")
    public ResponseEntity<?> valider(@PathVariable String id) {
        return updateStatut(id, "VALIDE");
    }

    // PUT /api/conge/{id}/refuser  — admin : refuser
    @PutMapping("/{id}/refuser")
    public ResponseEntity<?> refuser(@PathVariable String id) {
        return updateStatut(id, "REFUSE");
    }

    // PUT /api/conge/{id}  — employé : modifier une demande en attente
    @PutMapping("/{id}")
    public ResponseEntity<?> modifier(@PathVariable String id, @RequestBody Conge payload) {
        Optional<Conge> opt = congeRepository.findById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Conge conge = opt.get();
        if (!"EN_ATTENTE".equals(conge.getStatut())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Seules les demandes en attente peuvent être modifiées."));
        }

        LocalDate newStart = payload.getDateDebut();
        LocalDate newEnd = payload.getDateFin();
        if (payload.getUserId() == null || newStart == null || newEnd == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Données incomplètes."));
        }
        if (newEnd.isBefore(newStart)) {
            return ResponseEntity.badRequest().body(Map.of("message", "La date de fin doit être après la date de début."));
        }

        boolean overlap = congeRepository.findByUserId(payload.getUserId()).stream()
                .filter(c -> !c.getId().equals(id))
                .filter(c -> !"REFUSE".equals(c.getStatut()))
                .anyMatch(c -> datesOverlap(newStart, newEnd, c.getDateDebut(), c.getDateFin()));

        if (overlap) {
            return ResponseEntity.badRequest().body(Map.of("message", "Vous avez déjà une demande sur cette période."));
        }

        conge.setDateDebut(newStart);
        conge.setDateFin(newEnd);
        conge.setType(payload.getType());
        conge.setMotif(payload.getMotif());
        congeRepository.save(conge);
        return ResponseEntity.ok(conge);
    }

    // DELETE /api/conge/{id}/annuler  — employé : annuler une demande en attente
    @DeleteMapping("/{id}/annuler")
    public ResponseEntity<?> annuler(@PathVariable String id) {
        Optional<Conge> opt = congeRepository.findById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Conge conge = opt.get();
        if (!"EN_ATTENTE".equals(conge.getStatut())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Seules les demandes en attente peuvent être annulées."));
        }
        congeRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Demande annulée."));
    }

    private ResponseEntity<?> updateStatut(String id, String statut) {
        Optional<Conge> opt = congeRepository.findById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Conge conge = opt.get();
        conge.setStatut(statut);
        congeRepository.save(conge);
        return ResponseEntity.ok(Map.of("statut", statut));
    }

    private boolean datesOverlap(LocalDate startA, LocalDate endA, LocalDate startB, LocalDate endB) {
        if (startA == null || endA == null || startB == null || endB == null) {
            return false;
        }
        return !startA.isAfter(endB) && !startB.isAfter(endA);
    }
}