import { Link } from "../Link";
import { StepAction } from "./components";

export function RedditErrorStepAction({
  key,
  while: _while,
}: {
  key: string;
  while: string;
}) {
  return (
    <StepAction
      key={key}
      state="error"
      headline={`Vaultonomy hit an error while ${_while}`}
      details={
        <>
          This is probably temporary — is Reddit working?
          <ul>
            <li>Try refreshing your Reddit tab and try again soon.</li>
            <li>
              If this keeps happening, contact{" "}
              <Link href="https://reddit.com/u/h4l">u/h4l</Link> on Reddit or
              create an issue or discussion on{" "}
              <Link href="https://github.com/h4l/vaultonomy">
                Vaultonomy's GitHub repository
              </Link>
              .
            </li>
          </ul>
        </>
      }
    />
  );
}
