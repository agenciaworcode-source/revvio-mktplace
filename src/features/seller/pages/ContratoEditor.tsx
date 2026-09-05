import { ContractEditorPage } from "@/features/contracts/ContractEditorPage";
import { useSellerContractScope, useSellerAutofill } from "../contractScope";

export function SellerContratoEditor() {
  return (
    <ContractEditorPage scope={useSellerContractScope()} autofill={useSellerAutofill()} />
  );
}
