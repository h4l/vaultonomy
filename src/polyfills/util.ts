// This file intentionally exports nothing.
//
// It's here because the readable-stream library imports util and checks if it
// has a debuglog attribute, and uses it if it does. Vite makes the util module
// a proxy module that warns when any attributes are accessed, so these two
// behaviours clash and result in a warning.
//
// This empty module replaces Vite's proxy warning module, removing the warning.
