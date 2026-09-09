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

  const totalItems = (templates ?? []).reduce(
    (sum, template) => sum + (template.checklist_template_items?.length ?? 0),
    0
  );

  return (
    <div>
      <AppNav current="/checklists" />
      <div className="max-w-5xl mx-auto p-6 sm:py-10">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-500 mb-2">
              Quality standards
            </p>
            <h1 className="text-3xl font-semibold">Checklist templates</h1>
            <p className="text-sm text-muted mt-2 max-w-2xl">
              Create a consistent cleaning standard for every room and every turnover.
            </p>
          </div>
          <NewTemplateForm />
        </div>

        <div className="grid sm:grid-cols-3 gap-3 mt-7">
          <div className="border border-gray-800 rounded-xl p-4 bg-gray-950">
            <p className="text-xs text-muted">Room templates</p>
            <p className="text-2xl font-semibold mt-1">{templates?.length ?? 0}</p>
          </div>
          <div className="border border-gray-800 rounded-xl p-4 bg-gray-950">
            <p className="text-xs text-muted">Checklist items</p>
            <p className="text-2xl font-semibold mt-1 text-green-400">{totalItems}</p>
          </div>
          <div className="border border-gray-800 rounded-xl p-4 bg-gray-950">
            <p className="text-xs text-muted">Automatic setup</p>
            <p className="text-sm font-medium mt-2">Active for matching rooms</p>
          </div>
        </div>

        <StarterTemplatePicker />

        <div className="mt-9">
          <h2 className="text-lg font-medium">Your room templates</h2>
          <p className="text-xs text-muted mt-1">Open a template to edit its tasks or apply it to existing properties.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mt-4">
          {templates?.length === 0 && (
            <p className="text-muted text-sm">No templates yet. Add one above.</p>
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
