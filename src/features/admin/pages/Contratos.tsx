// Contratos do superadmin: todos os tipos, timbre da Revvender e catálogo do
// sistema inteiro no autopreenchimento.
import { ContractsListPage } from "@/features/contracts/ContractsListPage";
import { useAdminContractScope } from "../contractScope";

export function Contratos() {
  return <ContractsListPage scope={useAdminContractScope()} />;
}
