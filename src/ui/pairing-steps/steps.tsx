import { Link } from "../Link";
import { PAIRING_MESSAGE, WALLET } from "../ids";
import { StepAction } from "./components";

export function RedditErrorStepAction({
  key,
  while: _while,
}: {
  key?: string;
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
          <ul className="list-outside list-disc ml-6">
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

export function SignatureInvalidError() {
  return (
    <StepAction
      state="error"
      headline="The Message signature your Wallet provided is not correct"
      details={
        <>
          The signature doesn't match Reddit's Message and your Wallet address.
          <ul className="list-outside list-disc ml-6">
            <li>
              Is your Wallet showing the same <code>0x...</code> address as the{" "}
              <Link toId={WALLET}>Wallet</Link> section above? If not, reconnect
              your Wallet and try again.
            </li>
            <li>
              Did your Wallet show you the fields of{" "}
              <Link toId={PAIRING_MESSAGE}>Reddit's Message</Link>? If not, your
              Wallet may not support signing this type of structured data.
            </li>
          </ul>
        </>
      }
    />
  );
}
