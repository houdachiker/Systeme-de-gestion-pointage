package com.pointage.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalTime;

@Document(collection = "pointages")
@Data
@NoArgsConstructor
public class Pointage {

    @Id
    private String id;

    private String userId;

    private LocalDate date;

    private LocalTime heure;

    private String type; // "ENTREE" ou "SORTIE"

    private String latitude;

    private String longitude;

    private Boolean valide;

    private String qrCodeId;

    private String qrCode; // QR code value scanned by employee

    private String modeTravail; // "PRESENTIEL" ou "TELETRAVAIL"
}
