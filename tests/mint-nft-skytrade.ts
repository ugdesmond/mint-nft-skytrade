import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import {
  CreateNftOutput,
  Metaplex,
  keypairIdentity,
} from '@metaplex-foundation/js';
import { PROGRAM_ID as BUBBLEGUM_PROGRAM_ID } from '@metaplex-foundation/mpl-bubblegum';
import { PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID } from '@metaplex-foundation/mpl-token-metadata';

import {
  SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  SPL_NOOP_PROGRAM_ID,
} from '@solana/spl-account-compression';
import { Connection, Keypair, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { MintNftSkytrade } from '../target/types/mint_nft_skytrade';

describe('mint-nft-skytrade', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const wallet = provider.wallet as anchor.Wallet;
  const program = anchor.workspace.MintNftSkytrade as Program<MintNftSkytrade>;

  // const connection = program.provider.connection
  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

  const metaplex = Metaplex.make(connection).use(keypairIdentity(wallet.payer));

  // keypair for tree
  const merkleTree = Keypair.generate();

  // tree authority
  const [treeAuthority] = PublicKey.findProgramAddressSync(
    [merkleTree.publicKey.toBuffer()],
    BUBBLEGUM_PROGRAM_ID
  );

  // pda "tree creator", allows our program to update the tree
  const [pda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('AUTH')],
    program.programId
  );

  const [bubblegumSigner] = PublicKey.findProgramAddressSync(
    [Buffer.from('collection_cpi', 'utf8')],
    BUBBLEGUM_PROGRAM_ID
  );

  const metadata = {
    uri: 'https://arweave.net/h19GMcMz7RLDY7kAHGWeWolHTmO83mLLMNPzEkF32BQ',
    name: 'SKY-TRADE',
    symbol: 'SKY-T',
  };

  let collectionNft: CreateNftOutput;

  before(async () => {
    // Create collection nft
    collectionNft = await metaplex.nfts().create({
      uri: metadata.uri,
      name: metadata.name,
      symbol: metadata.symbol,
      sellerFeeBasisPoints: 0,
      isCollection: true,
    });

    // transfer collection nft metadata update authority to pda
    await metaplex.nfts().update({
      nftOrSft: collectionNft.nft,
      updateAuthority: wallet.payer,
      newUpdateAuthority: pda,
    });
  });

  it('Mint  NFT with Metaplex Bubblegum standard', async () => {
    const txSignature = await program.methods
      .mintNft()
      .accounts({
        pda: pda,
        merkleTree: merkleTree.publicKey,
        treeAuthority: treeAuthority,
        logWrapper: SPL_NOOP_PROGRAM_ID,
        bubblegumSigner: bubblegumSigner,
        bubblegumProgram: BUBBLEGUM_PROGRAM_ID,
        compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        collectionMint: collectionNft.mintAddress,
        collectionMetadata: collectionNft.metadataAddress,
        editionAccount: collectionNft.masterEditionAddress,
      })
      .rpc({ commitment: 'confirmed' });
    console.log(
      `>>>>>>>>>>>>>>>>.https://explorer.solana.com/tx/${txSignature}?cluster=devnet`
    );
  });
});
