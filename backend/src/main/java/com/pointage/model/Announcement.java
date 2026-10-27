package com.pointage.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "announcements")
@Data
@NoArgsConstructor
public class Announcement {

    @Id
    private String id;

    /** Texte de l'annonce (max 500 caractères côté front : 280) */
    private String text;

    /** "INFO" | "IMPORTANT" | "URGENT" */
    private String type;

    /** ID de l'admin qui a publié */
    private String authorId;

    /** Nom affiché de l'auteur (snapshot) */
    private String author;

    /** Date de création */
    private Instant createdAt;
}
