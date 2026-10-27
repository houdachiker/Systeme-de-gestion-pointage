package com.pointage.controller;

import com.pointage.model.Announcement;
import com.pointage.repository.AnnouncementRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/announcement")
@RequiredArgsConstructor
public class AnnouncementController {

    private final AnnouncementRepository repo;

    /** POST /api/announcement — publier une annonce (admin) */
    @PostMapping
    public ResponseEntity<?> publish(@RequestBody Announcement payload) {
        if (payload.getText() == null || payload.getText().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Le texte de l'annonce est requis."));
        }
        String text = payload.getText().trim();
        if (text.length() > 500) text = text.substring(0, 500);

        Announcement a = new Announcement();
        a.setText(text);
        a.setType(payload.getType() != null ? payload.getType() : "INFO");
        a.setAuthor(payload.getAuthor() != null ? payload.getAuthor() : "Administrateur");
        a.setAuthorId(payload.getAuthorId());
        a.setCreatedAt(Instant.now());

        Announcement saved = repo.save(a);
        return ResponseEntity.ok(saved);
    }

    /** GET /api/announcement — liste de toutes les annonces (admin + employé) */
    @GetMapping
    public ResponseEntity<List<Announcement>> getAll() {
        return ResponseEntity.ok(repo.findAllByOrderByCreatedAtDesc());
    }

    /** DELETE /api/announcement/{id} — supprimer (admin) */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable String id) {
        Optional<Announcement> opt = repo.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();
        repo.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Annonce supprimée."));
    }
}
