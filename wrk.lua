wrk.method = "POST"
wrk.body   = "{\"query\": \"query { author(id:1) { name }, book(id:2) { author { name }} }\"}"
wrk.headers["Content-Type"] = "application/json"