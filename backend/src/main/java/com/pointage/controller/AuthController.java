package com.pointage.controller;

import com.pointage.model.User;
import com.pointage.repository.UserRepository;
import com.pointage.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    // POST /api/auth/login
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String password = body.get("password");

        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty() || !passwordEncoder.matches(password, userOpt.get().getPassword())) {
            return ResponseEntity.status(401).body(Map.of("message", "Email ou mot de passe incorrect"));
        }

        User user = userOpt.get();
        String token = jwtUtil.generateToken(user.getEmail(), user.getRole());

        return ResponseEntity.ok(Map.of(
                "token", token,
                "role", user.getRole(),
                "nom", user.getNom(),
                "id", user.getId()
        ));
    }

    // POST /api/auth/register
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody User user) {
        if (userRepository.findByEmail(user.getEmail()).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Email déjà utilisé"));
        }
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        if (user.getRole() == null || user.getRole().isEmpty()) {
            user.setRole("EMPLOYE");
        }
        User saved = userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "Utilisateur créé", "id", saved.getId()));
    }

    // GET /api/auth/users
    @GetMapping("/users")
    public ResponseEntity<List<User>> getUsers() {
        List<User> users = userRepository.findAll();
        users.forEach(u -> u.setPassword(null)); // ne pas renvoyer les mots de passe
        return ResponseEntity.ok(users);
    }

    // PUT /api/auth/users/{id} - Modifier un employé
    @PutMapping("/users/{id}")
    public ResponseEntity<?> updateUser(@PathVariable String id, @RequestBody Map<String, String> body) {
        return userRepository.findById(id).map(user -> {
            if (body.containsKey("nom")) user.setNom(body.get("nom"));
            if (body.containsKey("email")) user.setEmail(body.get("email"));
            if (body.containsKey("matricule")) user.setMatricule(body.get("matricule"));
            if (body.containsKey("departement")) user.setDepartement(body.get("departement"));
            if (body.containsKey("role")) user.setRole(body.get("role"));
            if (body.containsKey("password") && !body.get("password").isEmpty()) {
                user.setPassword(passwordEncoder.encode(body.get("password")));
            }
            userRepository.save(user);
            user.setPassword(null);
            return ResponseEntity.ok(user);
        }).orElse(ResponseEntity.notFound().build());
    }

    // DELETE /api/auth/users/{id} - Supprimer un employé
    @DeleteMapping("/users/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable String id) {
        if (!userRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        userRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Employé supprimé"));
    }
}
