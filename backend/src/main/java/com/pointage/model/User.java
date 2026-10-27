package com.pointage.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.Indexed;

@Document(collection = "users")
@Data
@NoArgsConstructor
public class User {

    @Id
    private String id;

    private String nom;

    @Indexed(unique = true)
    private String email;

    private String password;

    private String role; // "ADMIN" ou "EMPLOYE"

    private String matricule;

    private String departement;
}
