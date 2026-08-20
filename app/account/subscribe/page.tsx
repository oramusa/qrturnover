import AppNav from "@/app/components/AppNav";
import EmbeddedCheckoutForm from "./EmbeddedCheckoutForm";

export default function SubscribePage() {
  return (
    <>
      <AppNav current="/account" />
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-6">Subscribe</h1>
        <EmbeddedCheckoutForm />
      </div>
    </>
  );
}
