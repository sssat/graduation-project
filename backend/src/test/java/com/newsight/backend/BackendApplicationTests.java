package com.newsight.backend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class BackendApplicationTests {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void contextLoads() {
	}

	@Test
	void openApiDocsArePublic() throws Exception {
		mockMvc.perform(get("/v3/api-docs"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.info.title").value("Newsight API"));
	}

	@Test
	void allOpenApiGroupIsPublic() throws Exception {
		mockMvc.perform(get("/v3/api-docs/all"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.info.title").value("Newsight API"));
	}

	@Test
	void allOpenApiYamlGroupIsPublic() throws Exception {
		mockMvc.perform(get("/v3/api-docs.yaml/all"))
				.andExpect(status().isOk());
	}

}
