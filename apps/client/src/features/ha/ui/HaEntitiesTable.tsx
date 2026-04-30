import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { HaState } from "@/entities/ha/types";

interface HaEntitiesTableProps {
  states: HaState[];
}

export const HaEntitiesTable: React.FC<HaEntitiesTableProps> = ({ states }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>All Entities</CardTitle>
        <CardDescription>
          Live states of all entities from your Home Assistant instance.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entity ID</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Attributes</TableHead>
              <TableHead>Last Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {states.map((entity) => (
              <TableRow key={entity.entity_id}>
                <TableCell className='font-medium'>
                  {entity.entity_id}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      entity.state === "on" || entity.state === "home"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {entity.state}
                  </Badge>
                </TableCell>
                <TableCell>
                  <pre className='text-xs bg-muted p-2 rounded-md overflow-x-auto'>
                    <code>{JSON.stringify(entity.attributes, null, 2)}</code>
                  </pre>
                </TableCell>
                <TableCell>
                  {new Date(entity.last_updated).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
