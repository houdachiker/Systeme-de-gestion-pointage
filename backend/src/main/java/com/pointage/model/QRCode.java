package com.pointage.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "qrcodes")
@Data
@NoArgsConstructor
public class QRCode {

    @Id
    private String id;

    private String valeur;

    // URL publique de pointage associée à ce QR code
    private String urlPointage;

    private LocalDateTime dateGeneration;

    private LocalDateTime dateExpiration;

    private Boolean actif;
}
