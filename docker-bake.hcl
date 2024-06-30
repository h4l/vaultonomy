group "default" {
    targets = ["tasks"]
}

target "tasks" {
    name = task
    matrix = {
        task = ["lint", "prettier", "typecheck", "test", "build"],
    }
    target = task
    no-cache-filter = [task]
    output = ["type=cacheonly"]
}
