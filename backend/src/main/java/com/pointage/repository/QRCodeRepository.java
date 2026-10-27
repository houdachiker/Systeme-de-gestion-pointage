package com.pointage.repository;

import com.pointage.model.QRCode;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface QRCodeRepository extends MongoRepository<QRCode, String> {
    Optional<QRCode> findByValeur(String valeur);
}
