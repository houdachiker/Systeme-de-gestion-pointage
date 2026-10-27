package com.pointage.controller;

import com.pointage.model.QRCode;
import com.pointage.repository.QRCodeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/qrcode")
@RequiredArgsConstructor
public class QRCodeController {

    private final QRCodeRepository qrCodeRepository;

    // URL de base du frontend (configurable via application.properties)
    @Value("${app.frontend.url:http://localhost:3000}")
    private String frontendUrl;

    // GET /api/qrcode - List all QR codes
    @GetMapping
    public ResponseEntity<List<QRCode>> getAll() {
        return ResponseEntity.ok(qrCodeRepository.findAll());
    }

    // POST /api/qrcode/generate - Generate a new QR code with associated URL
    @PostMapping("/generate")
    public ResponseEntity<?> generate() {
        String token = UUID.randomUUID().toString();
        String urlPointage = frontendUrl + "/scan/" + token;

        QRCode qr = new QRCode();
        qr.setValeur(token);
        qr.setUrlPointage(urlPointage);
        qr.setDateGeneration(LocalDateTime.now());
        qr.setDateExpiration(LocalDateTime.now().plusHours(24));
        qr.setActif(true);
        QRCode saved = qrCodeRepository.save(qr);
        return ResponseEntity.ok(saved);
    }

    // PATCH /api/qrcode/{id}/deactivate
    @PatchMapping("/{id}/deactivate")
    public ResponseEntity<?> deactivate(@PathVariable String id) {
        return qrCodeRepository.findById(id).map(qr -> {
            qr.setActif(false);
            qrCodeRepository.save(qr);
            return ResponseEntity.ok(Map.of("message", "QR code désactivé"));
        }).orElse(ResponseEntity.notFound().build());
    }

    // GET /api/qrcode/active - Get the active QR code
    @GetMapping("/active")
    public ResponseEntity<?> getActive() {
        return qrCodeRepository.findAll().stream()
                .filter(qr -> Boolean.TRUE.equals(qr.getActif())
                        && qr.getDateExpiration() != null
                        && qr.getDateExpiration().isAfter(LocalDateTime.now()))
                .findFirst()
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // GET /api/qrcode/token/{token} - Validate a QR token (used by scan URL page)
    @GetMapping("/token/{token}")
    public ResponseEntity<?> getByToken(@PathVariable String token) {
        return qrCodeRepository.findAll().stream()
                .filter(qr -> token.equals(qr.getValeur())
                        && Boolean.TRUE.equals(qr.getActif())
                        && qr.getDateExpiration() != null
                        && qr.getDateExpiration().isAfter(LocalDateTime.now()))
                .findFirst()
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
