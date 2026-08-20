import { createClient } from "@/lib/supabase/server";
import NewTemplateForm from "./NewTemplateForm";
import TemplateCard from "./TemplateCard";
import StarterTemplatePicker from "./StarterTemplatePicker";
import AppNav from "@/app/components/AppNav";

export default async function ChecklistsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: templates } = await supabase
    .from("checklist_templates")
    .select("id, room_type, checklist_template_items ( id, label, sort_order )")
    .eq("host_id", user!.id)
    .order("room_type", { ascending: true });

  return (
    <div>
      <AppNav current="/checklists" />
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-2">Checklist templates</h1>
        <p className="text-sm text-gray-500 mb-6">
          Define default items by room type (e.g. Kitchen, Bathroom). New zones with a matching
          name automatically start with these items — each zone then owns its own independent
          copy, so editing a zone never changes the template.
        </p>

        <StarterTemplatePicker />

        <NewTemplateForm />

        <div className="space-y-3 mt-6">
          {templates?.length === 0 && (
            <p className="text-gray-500 text-sm">No templates yet. Add one above.</p>
          )}
          {templates?.map((t) => (
            <TemplateCard
              key={t.id}
              templateId={t.id}
              roomType={t.room_type}
              items={(t.checklist_template_items ?? [])
                .slice()
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((i) => ({ id: i.id, label: i.label, sort_order: i.sort_order }))}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
