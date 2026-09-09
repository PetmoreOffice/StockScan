export type Branch = {
  key: string;
  name: string;
};

export type Product = {
  goodsKey: string;
  barcode: string;
  skuKey: string;
  skuCode: string;
  skuName: string;
  unitKey: string;
  unitName: string;
};

export type ScanEntry = Product & {
  branchKey: string;
  branchName: string;
  quantity: number;
  expiryDate: string;
  savedBy: string;
  savedAt: string;
};
