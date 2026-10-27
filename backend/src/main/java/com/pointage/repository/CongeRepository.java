package com.pointage.repository;

import com.pointage.model.Conge;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface CongeRepository extends MongoRepository<Conge, String> {
    List<Conge> findByUserId(String userId);
    List<Conge> findByStatut(String statut);
}
