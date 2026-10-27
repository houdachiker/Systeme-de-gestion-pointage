package com.pointage.config;

import com.pointage.model.User;
import com.pointage.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        try {
            if (userRepository.findByEmail("admin@pointage.com").isEmpty()) {
                User admin = new User();
                admin.setNom("Administrateur");
                admin.setEmail("admin@pointage.com");
                admin.setPassword(passwordEncoder.encode("Admin123"));
                admin.setRole("ADMIN");
                admin.setMatricule("ADM001");
                admin.setDepartement("Direction");
                userRepository.save(admin);
                System.out.println("Admin cree : admin@pointage.com / Admin123");
            } else {
                System.out.println("Admin deja existant.");
            }
        } catch (Exception e) {
            System.err.println("Impossible de se connecter a MongoDB au demarrage : " + e.getMessage());
            System.err.println("Verifiez que votre IP est whitelistee dans MongoDB Atlas Network Access.");
        }
    }
}
