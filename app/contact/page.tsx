import PublicNav from "@/app/components/PublicNav";
import ContactForm from "./ContactForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact QRTurnover for product questions, feedback, or support.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <>
      <PublicNav />
      <ContactForm />
    </>
  );
}
