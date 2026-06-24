import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Save, Settings, Package, Code2, Folder, Key } from "lucide-react";

import { orpc } from "@/utils/orpc";
import { Button } from "@Emitkit/ui/components/button";
import { Card } from "@Emitkit/ui/components/card";
import { Checkbox } from "@Emitkit/ui/components/checkbox";
import { Input } from "@Emitkit/ui/components/input";
import { Label } from "@Emitkit/ui/components/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@Emitkit/ui/components/select";
import { Skeleton } from "@Emitkit/ui/components/skeleton";

const configFormSchema = z.object({
  outputs: z.array(z.enum(["SDK", "CLI", "MCP", "DOCS"])),
  sdkLanguages: z.array(z.enum(["typescript", "python"])),
  outputDir: z.string().min(1, "Output directory is required"),
  sdkNpmScope: z.string().optional().nullable(),
  sdkPypiName: z.string().optional().nullable(),
  sdkVersionStrategy: z.enum(["emitkit-managed", "spec-version"]),
  geminiApiKey: z.string().optional().nullable(),
});

type ConfigFormValues = z.infer<typeof configFormSchema>;

interface ConfigTabProps {
  projectId: string;
}

export function ConfigTab({ projectId }: ConfigTabProps) {
  const queryClient = useQueryClient();

  // Query configuration
  const { data: config, isLoading } = useQuery(
    orpc.projects.config.get.queryOptions({ input: { projectId } })
  );

  // Mutation to save configuration
  const saveMutation = useMutation(
    orpc.projects.config.save.mutationOptions()
  );

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ConfigFormValues>({
    resolver: zodResolver(configFormSchema),
    defaultValues: {
      outputs: [],
      sdkLanguages: [],
      outputDir: ".emitkit/",
      sdkNpmScope: "",
      sdkPypiName: "",
      sdkVersionStrategy: "emitkit-managed",
      geminiApiKey: "",
    },
  });

  // Reset form when config is loaded
  useEffect(() => {
    if (config) {
      reset({
        outputs: config.outputs ?? [],
        sdkLanguages: config.sdkLanguages ?? [],
        outputDir: config.outputDir ?? ".emitkit/",
        sdkNpmScope: config.sdkNpmScope ?? "",
        sdkPypiName: config.sdkPypiName ?? "",
        sdkVersionStrategy: (config.sdkVersionStrategy as "emitkit-managed" | "spec-version") ?? "emitkit-managed",
        geminiApiKey: config.geminiApiKey ?? "",
      });
    }
  }, [config, reset]);

  const outputs = watch("outputs") || [];
  const sdkLanguages = watch("sdkLanguages") || [];

  const showSdkLanguages = outputs.includes("SDK");
  const showNpmScope = showSdkLanguages && sdkLanguages.includes("typescript");
  const showPypiName = showSdkLanguages && sdkLanguages.includes("python");

  const onSubmit = (data: ConfigFormValues) => {
    saveMutation.mutate(
      {
        projectId,
        outputs: data.outputs,
        sdkLanguages: showSdkLanguages ? data.sdkLanguages : [],
        outputDir: data.outputDir,
        sdkNpmScope: showNpmScope ? data.sdkNpmScope : null,
        sdkPypiName: showPypiName ? data.sdkPypiName : null,
        sdkVersionStrategy: data.sdkVersionStrategy,
        geminiApiKey: data.geminiApiKey || null,
      },
      {
        onSuccess: () => {
          toast.success("Configuration saved successfully");
          queryClient.invalidateQueries(
            orpc.projects.config.get.queryOptions({ input: { projectId } })
          );
        },
        onError: (err: any) => {
          toast.error(err.message || "Failed to save configuration");
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-48 rounded-lg" />
        <Card className="border border-border/80 bg-card/40 backdrop-blur-md rounded-2xl p-6 space-y-6">
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Settings className="size-4 text-indigo-400" />
          <span>Project Configuration</span>
        </h2>
      </div>

      <Card className="border border-border/80 bg-card/40 backdrop-blur-md rounded-2xl p-6 space-y-6 shadow-xs">
        {/* Output Types */}
        <div className="space-y-3">
          <Label className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <Package className="size-3.5 text-zinc-400" />
            Outputs to Generate
          </Label>
          <p className="text-[11px] text-muted-foreground leading-relaxed -mt-1">
            Choose what artifacts Emitkit should generate from your OpenAPI specification.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            {(["SDK", "CLI", "MCP", "DOCS"] as const).map((type) => (
              <Controller
                key={type}
                control={control}
                name="outputs"
                render={({ field }) => {
                  const isChecked = field.value.includes(type);
                  return (
                    <label className="flex items-center gap-2.5 p-3 rounded-xl border border-border/80 bg-zinc-950/20 hover:bg-muted/10 cursor-pointer select-none transition-all">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            field.onChange([...field.value, type]);
                          } else {
                            field.onChange(field.value.filter((v) => v !== type));
                          }
                        }}
                      />
                      <span className="text-xs font-semibold text-foreground">{type}</span>
                    </label>
                  );
                }}
              />
            ))}
          </div>
        </div>

        {/* SDK Languages (Conditional) */}
        {showSdkLanguages && (
          <div className="space-y-3 p-4 border border-indigo-500/10 bg-indigo-500/5 rounded-xl animate-fade-in">
            <Label className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
              <Code2 className="size-3.5" />
              SDK Target Languages
            </Label>
            <div className="flex items-center gap-4 pt-1">
              {(["typescript", "python"] as const).map((lang) => (
                <Controller
                  key={lang}
                  control={control}
                  name="sdkLanguages"
                  render={({ field }) => {
                    const isChecked = field.value.includes(lang);
                    return (
                      <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              field.onChange([...field.value, lang]);
                            } else {
                              field.onChange(field.value.filter((v) => v !== lang));
                            }
                          }}
                        />
                        <span className="text-xs font-semibold capitalize text-foreground">{lang}</span>
                      </label>
                    );
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Output Directory */}
        <div className="space-y-2">
          <Label htmlFor="outputDir" className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <Folder className="size-3.5" />
            Output Directory
          </Label>
          <Input
            id="outputDir"
            type="text"
            {...register("outputDir")}
            placeholder=".emitkit/"
            className="rounded-xl bg-zinc-950/20 border-border/80"
          />
          {errors.outputDir && (
            <p className="text-[10px] text-destructive font-semibold">{errors.outputDir.message}</p>
          )}
        </div>

        {/* Conditionally Rendered Npm Scope */}
        {showNpmScope && (
          <div className="space-y-2 animate-fade-in">
            <Label htmlFor="sdkNpmScope" className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              NPM Scope (Optional)
            </Label>
            <Input
              id="sdkNpmScope"
              type="text"
              {...register("sdkNpmScope")}
              placeholder="@scope"
              className="rounded-xl bg-zinc-950/20 border-border/80"
            />
          </div>
        )}

        {/* Conditionally Rendered PyPI Name */}
        {showPypiName && (
          <div className="space-y-2 animate-fade-in">
            <Label htmlFor="sdkPypiName" className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              PyPI Package Name (Optional)
            </Label>
            <Input
              id="sdkPypiName"
              type="text"
              {...register("sdkPypiName")}
              placeholder="my-pypi-package"
              className="rounded-xl bg-zinc-950/20 border-border/80"
            />
          </div>
        )}

        {/* SDK Version Strategy */}
        <div className="space-y-2">
          <Label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
            SDK Version Strategy
          </Label>
          <Controller
            control={control}
            name="sdkVersionStrategy"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full rounded-xl bg-zinc-950/20 border-border/80">
                  <SelectValue placeholder="Select version strategy" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border border-border">
                  <SelectItem value="emitkit-managed">
                    Emitkit Managed (Auto-incrementing semver based on changes)
                  </SelectItem>
                  <SelectItem value="spec-version">
                    Spec Version (Extract from OpenAPI spec definition version)
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {/* Gemini API Key */}
        <div className="space-y-2">
          <Label htmlFor="geminiApiKey" className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <Key className="size-3.5" />
            Gemini API Key
          </Label>
          <Input
            id="geminiApiKey"
            type="password"
            {...register("geminiApiKey")}
            placeholder={config?.geminiApiKey ? "********" : "Enter Gemini API Key (optional)"}
            className="rounded-xl bg-zinc-950/20 border-border/80 font-mono"
          />
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Required if generating documentation or interactive CLI elements that leverage Gemini intelligence.
          </p>
        </div>

        {/* Submit Action */}
        <div className="pt-2 flex justify-end">
          <Button
            type="submit"
            disabled={saveMutation.isPending || isSubmitting}
            className="rounded-xl font-semibold px-4 cursor-pointer"
          >
            {saveMutation.isPending || isSubmitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin mr-1.5" />
                Saving...
              </>
            ) : (
              <>
                <Save className="size-3.5 mr-1.5" />
                Save Configuration
              </>
            )}
          </Button>
        </div>
      </Card>
    </form>
  );
}
