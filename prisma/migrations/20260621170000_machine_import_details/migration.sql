-- Store the real machine information contained in the serial Excel file.
ALTER TABLE "Machine" ADD COLUMN "name" TEXT;
ALTER TABLE "Machine" ADD COLUMN "capacity" TEXT;
ALTER TABLE "Machine" ADD COLUMN "specification" TEXT;
ALTER TABLE "Machine" ADD COLUMN "warrantyMonths" INTEGER;
