import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <SignUp
      appearance={{
        variables: { colorPrimary: "#2563EB", fontFamily: "var(--font-sora)", borderRadius: "12px" },
        elements: { card: "shadow-none border border-slate-200" },
      }}
      signInUrl="/sign-in"
      forceRedirectUrl="/onboarding"
    />
  );
}
