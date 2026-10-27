package com.pointage.repository;

import com.pointage.model.Pointage;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.LocalDate;
import java.util.List;

public interface PointageRepository extends MongoRepository<Pointage, String> {
    List<Pointage> findByUserId(String userId);
    List<Pointage> findByDate(LocalDate date);
    List<Pointage> findByUserIdAndDate(String userId, LocalDate date);
}
