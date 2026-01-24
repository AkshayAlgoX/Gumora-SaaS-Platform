import { Card } from "@/components/ui/card";
import { ReactNode } from "react";


export function PanelCard({ title, description, right, children }: {
  title: string;
  description?: string;
  right?: ReactNode;
  children?: ReactNode
}) {
  return (
    <Card className="rounded-none border border-border bg-card p-4 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"> 
          <div className="text-base font-medium">{title}</div>
          {
            description ?
              <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null
          }
          {right ? <div className="shrink-0">{right}</div> : null}

        </div>
      </div>
      {children ? <div className="mt-0">{children}</div> : null}
    </Card>
  )
}
