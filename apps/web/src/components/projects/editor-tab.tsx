import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import { useState, useEffect } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { yaml } from "@codemirror/lang-yaml";
import { json } from "@codemirror/lang-json";
import { Button } from "@Emitkit/ui/components/button";
import { Alert, AlertDescription } from "@Emitkit/ui/components/alert";
import SwaggerParser from "@apidevtools/swagger-parser";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertTriangle, Save, Play } from "lucide-react";
import jsYaml from "js-yaml";

export function EditorTab({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const { data: spec, isLoading, error } = useQuery(
    orpc.projects.spec.get.queryOptions({ input: { projectId } })
  );

  const [content, setContent] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  const debouncedContent = useDebounce(content, 800);

  // Sync editor content with query data when loaded or updated
  useEffect(() => {
    if (spec?.content !== undefined && !isDirty) {
      setContent(spec.content);
    }
  }, [spec?.content, isDirty]);

  // Validate when debounced content changes
  useEffect(() => {
    let active = true;

    async function runValidation() {
      if (!debouncedContent.trim()) {
        if (active) {
          setValidationErrors(["Specification content cannot be empty"]);
        }
        return;
      }

      if (active) setIsValidating(true);
      try {
        let specObj: any;
        try {
          specObj = JSON.parse(debouncedContent);
        } catch {
          try {
            specObj = jsYaml.load(debouncedContent);
          } catch (yamlError: any) {
            if (active) {
              setValidationErrors([`Failed to parse content as JSON or YAML: ${yamlError.message}`]);
            }
            return;
          }
        }

        if (!specObj || typeof specObj !== "object") {
          if (active) {
            setValidationErrors(["Specification is not a valid JSON or YAML object"]);
          }
          return;
        }

        // SwaggerParser.validate parses, dereferences, and validates the API spec.
        // We pass a clone of the object and disable external resolution for security/performance in the browser.
        await SwaggerParser.validate(JSON.parse(JSON.stringify(specObj)), {
          resolve: {
            external: false,
          }
        });
        if (active) {
          setValidationErrors([]);
        }
      } catch (err: any) {
        if (active) {
          setValidationErrors([err.message || "Invalid OpenAPI specification format"]);
        }
      } finally {
        if (active) {
          setIsValidating(false);
        }
      }
    }

    runValidation();

    return () => {
      active = false;
    };
  }, [debouncedContent]);

  const saveMutation = useMutation({
    ...orpc.projects.spec.save.mutationOptions(),
    onSuccess: () => {
      setIsDirty(false);
      toast.success("Spec saved successfully");
      queryClient.invalidateQueries({ queryKey: [["projects", "spec", "get"]] });
    },
    onError: (err: any) => {
      if (err.message?.includes("CONFLICT")) {
        toast.error("Spec was updated externally. Please reload.");
      } else {
        toast.error(err.message || "Failed to save spec");
      }
    },
  });

  const triggerMutation = useMutation({
    ...orpc.projects.runs.trigger.mutationOptions(),
    onSuccess: () => {
      toast.success("Generation run triggered");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to trigger generation");
    },
  });

  const handleSave = () => {
    if (!spec?.sha) return;
    saveMutation.mutate({
      projectId,
      content,
      sha: spec.sha,
    });
  };

  const handleSaveAndGenerate = async () => {
    if (!spec?.sha) return;
    try {
      await saveMutation.mutateAsync({
        projectId,
        content,
        sha: spec.sha,
      });
      triggerMutation.mutate({ projectId });
    } catch (err) {
      // Save error is handled by mutation onError
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="size-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (error || !spec) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="size-4" />
        <AlertDescription>
          Failed to fetch repository specification: {error?.message || "Verify GitHub access tokens."}
        </AlertDescription>
      </Alert>
    );
  }

  const extension = spec.format === "json" ? json() : yaml();


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          {validationErrors.length > 0 ? (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-lg">
              <AlertTriangle className="size-3.5 flex-shrink-0" />
              <span className="truncate max-w-[280px] sm:max-w-[450px]">
                Invalid OpenAPI spec: {validationErrors[0]}
              </span>
            </div>
          ) : isValidating ? (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
              <Loader2 className="size-3.5 animate-spin flex-shrink-0" />
              <span>Validating spec...</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
              <CheckCircle2 className="size-3.5 flex-shrink-0" />
              <span>Valid OpenAPI spec</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleSave}
            disabled={!isDirty || saveMutation.isPending || validationErrors.length > 0}
            size="sm"
            variant="outline"
            className="rounded-lg text-xs font-semibold cursor-pointer border-zinc-800 hover:bg-zinc-900 hover:text-zinc-100"
          >
            {saveMutation.isPending ? (
              <Loader2 className="size-3.5 animate-spin mr-1.5" />
            ) : (
              <Save className="size-3.5 mr-1.5" />
            )}
            Save Spec
          </Button>
          <Button
            onClick={handleSaveAndGenerate}
            disabled={!isDirty || saveMutation.isPending || triggerMutation.isPending || validationErrors.length > 0}
            size="sm"
            className="rounded-lg text-xs font-semibold cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20"
          >
            {saveMutation.isPending || triggerMutation.isPending ? (
              <Loader2 className="size-3.5 animate-spin mr-1.5" />
            ) : (
              <Play className="size-3.5 mr-1.5" />
            )}
            Save & Generate
          </Button>
        </div>
      </div>

      <div className="border border-zinc-800 bg-zinc-950 rounded-xl overflow-hidden shadow-inner [&>.cm-editor]:bg-transparent [&>.cm-gutters]:bg-zinc-900/50 [&>.cm-gutters]:border-r [&>.cm-gutters]:border-zinc-800/80 [&>.cm-activeLine]:bg-zinc-900/20 [&>.cm-activeLineGutter]:bg-zinc-800/20 [&>.cm-editor]:outline-none">
        <CodeMirror
          value={content}
          height="550px"
          theme="dark"
          extensions={[extension]}
          onChange={(value) => {
            setContent(value);
            setIsDirty(spec ? value !== spec.content : false);
          }}
          className="text-sm font-mono"
        />
      </div>
    </div>
  );
}
