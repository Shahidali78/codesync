package com.codesync.api.controller;

import com.codesync.api.AbstractIntegrationTest;
import com.codesync.api.dto.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;

import static org.assertj.core.api.Assertions.assertThat;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class ProjectControllerTest extends AbstractIntegrationTest {

    @Autowired TestRestTemplate rest;

    static String token;
    static Long projectId;

    @BeforeAll
    static void registerUser(@Autowired TestRestTemplate rest) {
        var req = new RegisterRequest();
        req.setUsername("projuser");
        req.setEmail("projuser@example.com");
        req.setPassword("password123");
        AuthResponse resp = rest.postForEntity("/api/auth/register", req, AuthResponse.class).getBody();
        assertThat(resp).isNotNull();
        token = resp.getToken();
    }

    private HttpHeaders authHeaders() {
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        h.setContentType(MediaType.APPLICATION_JSON);
        return h;
    }

    @Test
    @Order(1)
    void create_project_returns_201() {
        var req = new ProjectRequest();
        req.setName("My Project");
        req.setDescription("Test project");
        req.setLanguage("python");

        ResponseEntity<ProjectResponse> resp = rest.exchange(
                "/api/projects", HttpMethod.POST,
                new HttpEntity<>(req, authHeaders()), ProjectResponse.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(resp.getBody()).isNotNull();
        assertThat(resp.getBody().getName()).isEqualTo("My Project");
        projectId = resp.getBody().getId();
    }

    @Test
    @Order(2)
    void list_projects_includes_created() {
        ResponseEntity<ProjectResponse[]> resp = rest.exchange(
                "/api/projects", HttpMethod.GET,
                new HttpEntity<>(authHeaders()), ProjectResponse[].class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isNotEmpty();
    }

    @Test
    @Order(3)
    void get_project_by_id() {
        ResponseEntity<ProjectResponse> resp = rest.exchange(
                "/api/projects/" + projectId, HttpMethod.GET,
                new HttpEntity<>(authHeaders()), ProjectResponse.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isNotNull();
        assertThat(resp.getBody().getId()).isEqualTo(projectId);
    }

    @Test
    @Order(4)
    void update_project() {
        var req = new ProjectRequest();
        req.setName("Renamed Project");
        req.setDescription("Updated");
        req.setLanguage("javascript");

        ResponseEntity<ProjectResponse> resp = rest.exchange(
                "/api/projects/" + projectId, HttpMethod.PUT,
                new HttpEntity<>(req, authHeaders()), ProjectResponse.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isNotNull();
        assertThat(resp.getBody().getName()).isEqualTo("Renamed Project");
    }

    @Test
    @Order(5)
    void create_and_list_files() {
        var req = new FileRequest();
        req.setName("main.py");
        req.setContent("print('hello')");

        ResponseEntity<FileResponse> created = rest.exchange(
                "/api/projects/" + projectId + "/files", HttpMethod.POST,
                new HttpEntity<>(req, authHeaders()), FileResponse.class);

        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(created.getBody()).isNotNull();
        assertThat(created.getBody().getName()).isEqualTo("main.py");

        ResponseEntity<FileResponse[]> listed = rest.exchange(
                "/api/projects/" + projectId + "/files", HttpMethod.GET,
                new HttpEntity<>(authHeaders()), FileResponse[].class);

        assertThat(listed.getBody()).hasSize(1);
    }

    @Test
    @Order(6)
    void delete_project_returns_204() {
        ResponseEntity<Void> resp = rest.exchange(
                "/api/projects/" + projectId, HttpMethod.DELETE,
                new HttpEntity<>(authHeaders()), Void.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }

    @Test
    @Order(7)
    void get_deleted_project_returns_404() {
        ResponseEntity<String> resp = rest.exchange(
                "/api/projects/" + projectId, HttpMethod.GET,
                new HttpEntity<>(authHeaders()), String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
