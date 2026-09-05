import { ContractsListPage } from "@/features/contracts/ContractsListPage";
import { useSellerContractScope } from "../contractScope";

export function SellerContratos() {
  return <ContractsListPage scope={useSellerContractScope()} />;
}
