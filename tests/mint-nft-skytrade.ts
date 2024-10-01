import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import {
  CreateCompressedNftOutput,
  Metaplex,
  keypairIdentity,
} from '@metaplex-foundation/js';
import {
  MPL_BUBBLEGUM_PROGRAM_ID,
  findTreeConfigPda,
} from '@metaplex-foundation/mpl-bubblegum';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { PublicKey as UmiPK } from '@metaplex-foundation/umi';
import { PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID } from '@metaplex-foundation/mpl-token-metadata';

import {
  ConcurrentMerkleTreeAccount,
  SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  SPL_NOOP_PROGRAM_ID,
  ValidDepthSizePair,
  createAllocTreeIx,
} from '@solana/spl-account-compression';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  clusterApiUrl,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { assert } from 'chai';
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

  const umi = createUmi(provider.connection.rpcEndpoint);

  const treeConfig = findTreeConfigPda(umi, {
    merkleTree: merkleTree.publicKey.toBase58() as UmiPK,
  })[0];

  // pda "tree creator", allows our program to update the tree
  const [treeOwner] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode('tree_owner'),
      merkleTree.publicKey.toBuffer(),
    ],
    program.programId
  );

  const centralAuthority = PublicKey.findProgramAddressSync(
    [Buffer.from('central_authority')],
    program.programId
  )[0];

  const [bubblegumSigner, _] = PublicKey.findProgramAddressSync(
    // `collection_cpi` is a custom prefix required by the Bubblegum program
    [Buffer.from('collection_cpi', 'utf8')],
    new anchor.web3.PublicKey(MPL_BUBBLEGUM_PROGRAM_ID)
  );

  const maxDepthSizePair: ValidDepthSizePair = {
    maxDepth: 14,
    maxBufferSize: 64,
  };
  const canopyDepth = maxDepthSizePair.maxDepth - 5;

  const metadata = {
    uri: 'https://arweave.net/h19GMcMz7RLDY7kAHGWeWolHTmO83mLLMNPzEkF32BQ',
    name: 'SKY-TRADE',
    symbol: 'SKY-T',
  };

  let collectionNft: CreateCompressedNftOutput;

  before(async () => {
    // Create collection nft
    //Initialize collections
    collectionNft = await metaplex.nfts().create({
      uri: metadata.uri,
      name: metadata.name,
      symbol: metadata.symbol,
      sellerFeeBasisPoints: 0,
      isCollection: true,
    });
    console.log('====nft location====', collectionNft.mintAddress);

    // transfer collection nft metadata update authority to pda
    await metaplex.nfts().update({
      nftOrSft: collectionNft.nft,
      updateAuthority: wallet.payer,
      newUpdateAuthority: treeOwner,
    });

    // instruction to create new account with required space for tree
    const allocTreeIx = await createAllocTreeIx(
      connection,
      merkleTree.publicKey,
      wallet.publicKey,
      maxDepthSizePair,
      canopyDepth
    );

    const tx = new Transaction().add(allocTreeIx);

    const txSignature = await sendAndConfirmTransaction(
      connection,
      tx,
      [wallet.payer, merkleTree],
      {
        commitment: 'confirmed',
      }
    );
    console.log(`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`);
    console.log('Tree Address:', merkleTree.publicKey.toBase58());
  });

  it('Create Tree', async () => {
    // create tree via CPI
    const txSignature = await program.methods
      .createTree(maxDepthSizePair.maxDepth, maxDepthSizePair.maxBufferSize)
      .accounts({
        signer: wallet.payer.publicKey,
        treeConfig,
        merkleTree: merkleTree.publicKey,
        treeOwner,
        logWrapper: SPL_NOOP_PROGRAM_ID,
        mplBubblegumProgram: MPL_BUBBLEGUM_PROGRAM_ID,
        compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
      })
      .rpc({ commitment: 'confirmed' });
    console.log(`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`);
    // fetch tree account
    const treeAccount = await ConcurrentMerkleTreeAccount.fromAccountAddress(
      connection,
      merkleTree.publicKey
    );

    console.log('MaxBufferSize', treeAccount.getMaxBufferSize());
    console.log('MaxDepth', treeAccount.getMaxDepth());
    console.log('Tree Authority', treeAccount.getAuthority().toString());
    assert.strictEqual(
      treeAccount.getMaxBufferSize(),
      maxDepthSizePair.maxBufferSize
    );
    assert.strictEqual(treeAccount.getMaxDepth(), maxDepthSizePair.maxDepth);
  });

  it('Mints a cnft to an existing tree and collection', async () => {
    // NFT metadata
    const name = 'KONNA';
    const symbol = 'KNA';
    const uri =
      'https://arweave.net/Apu1g7uhv52CMeQNfevoody9dVDmaWtQ3TklI6cbNRM';
    const sellerFeeBasisPoints = 0;

    const tx = await program.methods
      .mintCnft(name, symbol, uri, sellerFeeBasisPoints)
      .accounts({
        treeConfig,
        leafOwner: wallet.publicKey,
        merkleTree: merkleTree.publicKey,
        centralAuthority: treeOwner,
        collectionMint: collectionNft.mintAddress,
        collectionMetadata: collectionNft.metadataAddress,
        editionAccount: collectionNft.masterEditionAddress,
        bubblegumSigner,
        logWrapper: SPL_NOOP_PROGRAM_ID,
        compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        bubblegumProgram: MPL_BUBBLEGUM_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc({ commitment: 'confirmed' });
    console.log(`https://explorer.solana.com/tx/${tx}?cluster=devnet`);
  });
});
