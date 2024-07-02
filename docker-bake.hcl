variable "SOURCE_DATE_EPOCH" {
  default = "0"
}

group "default" {
    targets = ["tasks"]
}

target "tasks" {
    name = task
    matrix = {
        task = ["lint", "prettier", "typecheck", "test"],
    }
    target = task
    no-cache-filter = [task]
    output = ["type=cacheonly"]
}

target "builds" {
  name = "build-${browser}-${release}"
  matrix = {
    browser = ["chrome", "firefox"]
    release = ["development", "production"]
  }
  target = "built-files"
  args = {
    BROWSER = browser
    RELEASE = release
  }
  output = ["type=local,dest=dist/${browser}-${release}"]
}

target "packages" {
  name = "package-${browser}"
  matrix = {
    browser = ["chrome", "firefox"]
  }
  args = {
    BUILDKIT_SBOM_SCAN_CONTEXT = true
    BROWSER = browser
    RELEASE = "production"
    SOURCE_DATE_EPOCH = SOURCE_DATE_EPOCH
  }
  output = ["type=local,dest=dist/packages/${browser}-production"]
  attest = ["type=sbom", "type=provenance,mode=max"]
}
