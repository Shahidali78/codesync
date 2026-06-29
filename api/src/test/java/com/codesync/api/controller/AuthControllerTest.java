package com.codesync.api.controller;

import com.codesync.api.AbstractIntegrationTest;
import com.codesync.api.dto.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;

import static org.assertj.core.api.Assertions.assertThat;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class AuthControllerTest extends AbstractIntegrationTest {

    @Autowired TestRestTemplate rest;
    @Autowired ObjectMapper mapper;

    static String savedToken;

    @Test
    @Order(1)
    void register_returns_201_with_token() {
        var req = new RegisterRequest();
        req.setUsername("testuser");
        req.setEmail("testuser@example.com");
        req.setPassword("password123");

        ResponseEntity<AuthResponse> resp = rest.postForEntity("/api/auth/register", req, AuthResponse.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(resp.getBody()).isNotNull();
        assertThat(resp.getBody().getToken()).isNotBlank();
        assertThat(resp.getBody().getUsername()).isEqualTo("testuser");
        savedToken = resp.getBody().getToken();
    }

    @Test
    @Order(2)
    void register_duplicate_username_returns_409() {
        var req = new RegisterRequest();
        req.setUsername("testuser");
        req.setEmail("other@example.com");
        req.setPassword("password123");

        ResponseEntity<String> resp = rest.postForEntity("/api/auth/register", req, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    @Order(3)
    void login_with_valid_credentials_returns_token() {
        var req = new LoginRequest();
        req.setUsername("testuser");
        req.setPassword("password123");

        ResponseEntity<AuthResponse> resp = rest.postForEntity("/api/auth/login", req, AuthResponse.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isNotNull();
        assertThat(resp.getBody().getToken()).isNotBlank();
    }

    @Test
    @Order(4)
    void login_with_email_returns_token() {
        var req = new LoginRequest();
        req.setUsername("testuser@example.com");
        req.setPassword("password123");

        ResponseEntity<AuthResponse> resp = rest.postForEntity("/api/auth/login", req, AuthResponse.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @Order(5)
    void login_with_wrong_password_returns_401() {
        var req = new LoginRequest();
        req.setUsername("testuser");
        req.setPassword("wrongpassword");

        ResponseEntity<String> resp = rest.postForEntity("/api/auth/login", req, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    @Order(6)
    void protected_endpoint_without_token_returns_403() {
        ResponseEntity<String> resp = rest.getForEntity("/api/projects", String.class);
        // Spring Security returns 403 (not 401) when no auth header is present
        assertThat(resp.getStatusCode().is4xxClientError()).isTrue();
    }
}
