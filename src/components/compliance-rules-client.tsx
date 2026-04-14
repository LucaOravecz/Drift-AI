"use client";

import { useState } from "react";
import { ComplianceRule } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit2 } from "lucide-react";
import { toast } from "sonner";

interface ComplianceRulesClientProps {
  initialRules: ComplianceRule[];
}

export function ComplianceRulesClient({ initialRules }: ComplianceRulesClientProps) {
  const [rules, setRules] = useState<ComplianceRule[]>(initialRules);
  const [isCreating, setIsCreating] = useState(false);
  const [editingRule, setEditingRule] = useState<string | null>(null);

  const handleDelete = async (ruleId: string) => {
    try {
      const response = await fetch(`/api/compliance/rules/${ruleId}`, {
        method: "DELETE"
      });

      if (!response.ok) throw new Error("Failed to delete rule");

      setRules(rules.filter(r => r.id !== ruleId));
      toast.success("Rule deleted");
    } catch (err) {
      toast.error("Failed to delete rule");
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return "bg-red-100 text-red-800";
      case "HIGH":
        return "bg-orange-100 text-orange-800";
      case "MEDIUM":
        return "bg-yellow-100 text-yellow-800";
      case "LOW":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Compliance Rules</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Manage custom compliance patterns and detection rules
          </p>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-zinc-500">No custom rules yet. Create one to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rules.map(rule => (
            <Card key={rule.id} className={!rule.isActive ? "opacity-60" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{rule.name}</CardTitle>
                    <p className="text-sm text-zinc-500 mt-1">{rule.category}</p>
                  </div>
                  <Badge className={getSeverityColor(rule.severity)}>
                    {rule.severity}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(rule.config as any)?.keywords && (rule.config as any).keywords.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-zinc-600 mb-1">Keywords</p>
                      <div className="flex flex-wrap gap-1">
                        {(rule.config as any).keywords.map((kw: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {kw}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {(rule.config as any)?.regexPatterns && (rule.config as any).regexPatterns.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-zinc-600 mb-1">
                        Regex Patterns ({(rule.config as any).regexPatterns.length})
                      </p>
                      <div className="bg-zinc-50 p-2 rounded text-xs font-mono text-zinc-700 max-h-20 overflow-y-auto">
                        {(rule.config as any).regexPatterns.map((pattern: string, i: number) => (
                          <div key={i} className="mb-1">
                            {pattern}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingRule(rule.id)}
                    >
                      <Edit2 className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(rule.id)}
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
