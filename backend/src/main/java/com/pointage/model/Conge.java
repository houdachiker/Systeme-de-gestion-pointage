package com.pointage.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;

@Document(collection = "conges")
@Data
@NoArgsConstructor
public class Conge {

    @Id
    private String id;

    private String userId;

    private LocalDate dateDebut;

    private LocalDate dateFin;

    private String type; // "ANNUEL", "MALADIE", "EXCEPTIONNEL"

    private String statut; // "EN_ATTENTE", "VALIDE", "REFUSE"

    private String motif;
}
