# Change priority of issues to ignore things we can't/won't fix.
def classify(issue):
  # react has functions that assign to innerHTML which I think is the main
  # trigger of this. We can't really avoid it.
  if (issue.code == "UNSAFE_VAR_ASSIGNMENT" and issue.message == "Unsafe assignment to innerHTML")
  # We don't call this in the Firefox build so this is spurious.
  or (issue.code == "UNSUPPORTED_API" and issue.message == "sidePanel.setPanelBehavior is not supported")
  then issue + {_type: "notice"}
  else issue end
;

. as $input
| $input.errors + $input.warnings + $input.issues
| map(classify(.))
| {errors: map(select(._type == "error")),
   warnings: map(select(._type == "warning")),
   notices: map(select(._type == "notice"))} as $reclassified_issues
| $input + $reclassified_issues
| . + {
  summary: {
    errors: .errors | length,
    warnings: .warnings | length,
    notices: .notices | length
  }
}
