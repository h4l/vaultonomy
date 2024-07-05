// Set in GitHub Actions to "tag" or "branch"
variable "GITHUB_REF_TYPE" { default = "" }
// Set in GitHub actions to the branch or tag name, e.g. v0.1.2
variable "GITHUB_REF_NAME" { default = "" }

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

function "build_tag" {
  params = []
  result = GITHUB_REF_TYPE == "tag" ? GITHUB_REF_NAME : ""
}

target "packages" {
  name = "package-${browser}"
  matrix = {
    browser = ["chrome", "firefox"]
  }
  args = {
    BROWSER = browser
    RELEASE = "production"
    BUILD_TAG = build_tag()
  }
  output = ["type=local,dest=dist/packages/${browser}-production"]
  attest = ["type=sbom", "type=provenance,mode=max"]
}
