import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <SignIn
      appearance={{
        variables: { colorPrimary: "#2563EB", fontFamily: "var(--font-sora)", borderRadius: "12px" },
        elements: { card: "shadow-none border border-slate-200" },
      }}
      signUpUrl="/sign-up"
      forceRedirectUrl="/dashboard"
    />
  );
}
