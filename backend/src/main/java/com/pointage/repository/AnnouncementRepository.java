package com.pointage.repository;

import com.pointage.model.Announcement;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface AnnouncementRepository extends MongoRepository<Announcement, String> {
    /** Liste triée par date desc (les plus récentes en haut) */
    List<Announcement> findAllByOrderByCreatedAtDesc();
}
