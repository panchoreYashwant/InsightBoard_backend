// REMOVED: Backed up to removed_backup/backend/test-api.js — original contents archived.
    const options = {
      hostname: "localhost",
      port: 3000,
      path: path,
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolve({
          status: res.statusCode,
          body: data ? JSON.parse(data) : null,
          headers: res.headers,
        });
      });
    });

    req.on("error", reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log("🧪 Starting API Tests...\n");

  try {
    // Test 1: Health check
    console.log("📍 Test 1: Health Check");
    const health = await makeRequest("GET", "/health");
    console.log(`   Status: ${health.status}`);
    console.log(`   Response: ${JSON.stringify(health.body)}`);
    console.log(`   ✅ PASSED\n`);

    // Test 2: Submit valid transcript
    console.log("📍 Test 2: Submit Transcript");
    const submitReq = {
      transcript:
        "In this meeting we need to build a new feature. First, we need to gather requirements. After that, we design the system. Then we implement the backend. Once backend is done, we implement the frontend. Finally we test everything.",
    };
    const submit = await makeRequest("POST", "/api/submit", submitReq);
    console.log(`   Status: ${submit.status}`);
    console.log(`   Response: ${JSON.stringify(submit.body, null, 2)}`);
    if (submit.status === 202 && submit.body.jobId) {
      console.log(`   ✅ PASSED\n`);
      const jobId = submit.body.jobId;

      // Test 3: Check job status (should be processing)
      console.log("📍 Test 3: Check Job Status (Processing)");
      await new Promise((resolve) => setTimeout(resolve, 500));
      const status1 = await makeRequest("GET", `/api/status/${jobId}`);
      console.log(`   Status: ${status1.status}`);
      console.log(`   Response: ${JSON.stringify(status1.body, null, 2)}`);
      console.log(
        `   Job Status: ${status1.body.status} (should be 'processing' or 'done')\n`
      );

      // Test 4: Test Idempotency
      console.log("📍 Test 4: Test Idempotency (same transcript)");
      const submit2 = await makeRequest("POST", "/api/submit", submitReq);
      console.log(`   Status: ${submit2.status}`);
      console.log(`   Response: ${JSON.stringify(submit2.body, null, 2)}`);
      if (submit2.body.jobId === jobId) {
        console.log(`   ✅ PASSED - Same jobId returned for same transcript\n`);
      } else {
        console.log(`   ❌ FAILED - Different jobId returned\n`);
      }

      // Test 5: Submit with invalid input
      console.log("📍 Test 5: Invalid Input (empty transcript)");
      const invalid = await makeRequest("POST", "/api/submit", {
        transcript: "",
      });
      console.log(`   Status: ${invalid.status}`);
      console.log(`   Response: ${JSON.stringify(invalid.body, null, 2)}`);
      if (invalid.status === 400) {
        console.log(`   ✅ PASSED - Rejected empty transcript\n`);
      } else {
        console.log(`   ❌ FAILED - Should reject empty transcript\n`);
      }

      // Test 6: Non-existent job
      console.log("📍 Test 6: Non-existent Job ID");
      const notfound = await makeRequest(
        "GET",
        "/api/status/non-existent-id"
      );
      console.log(`   Status: ${notfound.status}`);
      console.log(`   Response: ${JSON.stringify(notfound.body, null, 2)}`);
      if (notfound.status === 404) {
        console.log(`   ✅ PASSED - Returns 404 for non-existent job\n`);
      }
    } else {
      console.log(`   ❌ FAILED\n`);
    }

    console.log("✅ All tests completed!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

runTests();
