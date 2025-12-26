#!/usr/bin/env node
import path from "path";
import os from "os";
import * as crypto from "crypto"
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { execSync } from "child_process";
import fs from "fs"
import dirtoFileArray from "./recursive_file_extractor.js"
import { PinataSDK } from "pinata";
import { provideClient }  from "./dbconnection.js"


const IHUB_DIR = path.join(os.homedir(), ".ihub");
const FILE_TO_STORE_LOGIN = path.join(IHUB_DIR, "login.txt");



async function UpdateRepo(cid,pinata) {
  
  
    const result = await pinata.gateways.public.get(cid)
    const Data = result.data;
    console.log(Data)
    const arrayBuffer = await Data.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer);
    console.log(buffer)
    deleteFilesWithExtension(".history.bundle",".")
    let dynamicstring=crypto.randomUUID()
    let shortID = dynamicstring.substring(0, 5)
    let bpath=`${shortID}.history.bundle`

    fs.writeFileSync(`${bpath}`,buffer);

    //const absolutePath  = path.resolve(folder);
    const absoluteBundlePath = path.resolve(bpath);

    execSync(`git fetch  ${absoluteBundlePath} refs/heads/*:refs/remotes/bundle/*`, {
      cwd: `.`,
      stdio: 'inherit'
    });

    const currentBranch = execSync(
          `git branch --show-current`,
      {
        cwd: '.',
        encoding: 'utf8',
        shell: true
      }
      ).trim();

  const bundleBranch = `bundle/${currentBranch}`;

  console.log(`🔀 Merging ${bundleBranch} → ${currentBranch}`);
  execSync(
    `git merge ${bundleBranch} --allow-unrelated-histories --no-edit`,
    {
      cwd: '.',
      stdio: 'inherit',
      shell: true
    }
  );

    console.log("pulled successfully")

  }



async function Pull(folder,pinata,client){

    
    const db = client.db("ihub_db");
    const coll = db.collection("ihub_col");
    const targetManifestId= fs.readFileSync(FILE_TO_STORE_LOGIN,'utf8');
    const doc = await coll.findOne({
        "owner": "system",
        "manifests.id": targetManifestId 
    });
    if(doc) {

        let uploads=null
        let bundle=null
        let manifests=doc.manifests
    

    for(let obj of  manifests){
        
        let dbfolder=String(obj.folder)

          if(obj.id==targetManifestId && dbfolder==folder){
              console.log(obj.folder)
              uploads=obj.uploads
           }

    

        }
        console.log(uploads)
  
    for(let obj of uploads){

        let name=obj.name
        const isIncluded = name.includes(".history.bundle");
        if(isIncluded) {

                bundle=obj.cid

          }}
       
          await UpdateRepo(bundle,pinata)
    
    }}



async function getcreds() {

  let request=await fetch("https://immutablehub-creds.hf.space/creds",{
    mode:"cors",
    method:"get",
    headers:{
      "content-type":"application/json"
    }
  })
  let response=await request.json()
  return {"jwt":response.jwt,"gateway":response.gateway}
  
}

async function getRuntime() {
  const { jwt, gateway } = await getcreds();
  const pinata = new PinataSDK({ pinataJwt: jwt, pinataGateway: gateway });
  const client = provideClient();
  return { pinata, client };
}





function setUp(wallet) {


     if (!fs.existsSync(IHUB_DIR)) {
            fs.mkdirSync(IHUB_DIR, { recursive: true });

    }

    if(fs.existsSync(FILE_TO_STORE_LOGIN)){
        console.log("already loggedin")
    }
    else {

        fs.writeFileSync(FILE_TO_STORE_LOGIN, wallet)
        console.log(`Successfully wrote wallet data to ${FILE_TO_STORE_LOGIN}`);

        
    }
}



function fileWithExtensionExists(extension,folder) {
  try {
    const files = fs.readdirSync(folder);
    const exists = files.some(fileName => 
      fileName.endsWith(extension)
    );

    return exists;
    
  } catch (error) {
    console.error(`Error checking directory: ${error.message}`);
    return false;
  }
}







  async function deleteManifest(targetManifestId, foldername,client) {


  const db = client.db("ihub_db");
  const coll = db.collection("ihub_col");
  await coll.updateOne(
    { owner: "system" },
    {
      $pull: {
        manifests: {
          id: targetManifestId,
          folder: foldername
        }
      }
    }
  );
  
}



async function manifestExists(targetManifestId, foldername,client) {

  const db = client.db("ihub_db");
  const coll = db.collection("ihub_col");
  const doc = await coll.findOne(
    {
      owner: "system",
      manifests: {
        $elemMatch: {
          id: targetManifestId,
          folder: foldername
        }
      }
    },
    { projection: { _id: 1 }}
  );
  return !!doc;
}



async function getFile(folder,cid,pinata) {
  
    const result = await pinata.gateways.public.get(cid)
    const Data = result.data;
    console.log(Data)
    const arrayBuffer = await Data.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer);
    console.log(buffer)

   

    //tester
    deleteFilesWithExtension(".history.bundle",".")


    let dynamicstring=crypto.randomUUID()
    let shortID = dynamicstring.substring(0, 5)
    let bpath=`${shortID}.history.bundle`

    fs.writeFileSync(`${bpath}`,buffer);

    const absolutePath  = path.resolve(folder);

     if (fs.existsSync(absolutePath)){
      fs.rmSync(absolutePath, { recursive: true, force: true });
     }


    fs.mkdirSync(absolutePath, { recursive: true });

    execSync(`git clone ${bpath} ${absolutePath}`, {
      cwd: ".",
      stdio: 'inherit'
    });
    console.log("cloned successfully")

}



async function  getFileNew(folder,obj,pinata) {

  const result = await pinata.gateways.public.get(obj.cid)
    const Data = result.data;
    
    const filePath = path.join(folder, obj.name);
    fs.writeFileSync(`${filePath}`,Data,"utf-8");
    console.log("successfully")

  
}


function deleteFilesWithExtension(extension, folder) {
  try {


    const absolutePath  = path.resolve(folder);
    const files = fs.readdirSync(absolutePath);

    for (const file of files) {
      if (file.endsWith(extension)) {
        const fullPath = path.join(folder, file);
        fs.unlinkSync(fullPath);
        console.log(`🗑️ Deleted old bundle: ${file}`);
      }
    }
  } catch (err) {
    console.error(`Error deleting bundle files: ${err.message}`);
  }
}


function gitBundler(FOLDER_TO_UPLOAD){


    let dynamicstring=crypto.randomUUID()
    let shortID = dynamicstring.substring(0, 5)
    let bpath=`${shortID}.history.bundle`
    let patternexists=fileWithExtensionExists(".history.bundle",FOLDER_TO_UPLOAD);
    if(patternexists){
        deleteFilesWithExtension(".history.bundle", FOLDER_TO_UPLOAD);
    }

    const bundlePath = path.join(FOLDER_TO_UPLOAD,bpath);
    execSync(`git bundle create ${path.basename(bundlePath)} --all`, {
      cwd: FOLDER_TO_UPLOAD,
      stdio: 'inherit'
    });
    const bundleSize = fs.statSync(bundlePath).size;
    console.log(`✓ Bundle created: ${(bundleSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Location: ${bundlePath}\n`);


  }


async function Clone(folder,pinata,client){

    
    const db = client.db("ihub_db");
    const coll = db.collection("ihub_col");
    const targetManifestId= fs.readFileSync(FILE_TO_STORE_LOGIN,'utf8');
    const doc = await coll.findOne({
        "owner": "system",
        "manifests.id": targetManifestId 
    });
    if(doc) {

        let uploads=null
        let bundle=null
        let manifests=doc.manifests
    

    for(let obj of  manifests){
        
        let dbfolder=String(obj.folder)

          if(obj.id==targetManifestId && dbfolder==folder){
              console.log(obj.folder)
              uploads=obj.uploads
           }

    

        }
        console.log(uploads)
  
    for(let obj of uploads){

        let name=obj.name
        const isIncluded = name.includes(".history.bundle");
        if(isIncluded) {

                bundle=obj.cid

          }}

      await getFile(folder,bundle,pinata)

  }}

  



async function CloneNew(folder,pinata,client){

    
    const db = client.db("ihub_db");
    const coll = db.collection("ihub_col");
    const targetManifestId= fs.readFileSync(FILE_TO_STORE_LOGIN,'utf8');
    const doc = await coll.findOne({
        "owner": "system",
        "manifests.id": targetManifestId 
    });
    if(doc) {

        let uploads=null
        let manifests=doc.manifests
    

    for(let obj of  manifests){
        
        let dbfolder=String(obj.folder)

          if(obj.id==targetManifestId && dbfolder==folder){
              console.log(obj.folder)
              uploads=obj.uploads
              fs.mkdirSync(folder)
           }

    

        }
        console.log(uploads)
  
    for(let obj of uploads){

        await getFileNew(folder,obj,pinata)
       
    }

  }}






async function Push(FOLDER_TO_UPLOAD,pinata,client) {

     try {


        const db = client.db("ihub_db");
        const coll = db.collection("ihub_col");

        let uploads=[]
        const absolutePath = path.resolve(FOLDER_TO_UPLOAD);
        let files=dirtoFileArray(absolutePath)

        for (let file of files) {

            const upload=await pinata.upload.public.file(file)
            uploads.push(upload)
        }


        console.log(uploads)
        const data = fs.readFileSync(FILE_TO_STORE_LOGIN, 'utf8');
        const lastpath = path.basename(absolutePath);

        let meta={"id":data,"folder":lastpath,"uploads":uploads,"is_latest":true}


        let docalreadyexists=await manifestExists(data,lastpath,client)
        if (docalreadyexists){
             await deleteManifest(data,lastpath,client)
        }

        await coll.findOneAndUpdate(
            {"owner":"system"},
            {
            $push: {
            manifests: meta
            }})
     }
     catch(e){

      console.log(e)
      
     }

}






yargs(hideBin(process.argv))
  .command(
    'op', 
    'Interface for ihub operations (login, push, clone).',
    (yargs) => {
      return yargs
        .command(
          'login <walletpublickey>',
          'Logs into ihub using a wallet address.',
          (yargs) => {
            return yargs.positional('walletpublickey', {
              describe: 'The wallet address to login with',
              type: 'string'
            });
          },
          (argv) => {
            setUp(argv.walletpublickey);
            console.log("Login successful.");
          }
        )
        .command(
          'push <folderpath>', 
          'Pushes the contents of a local folder.',
          (yargs) => {
            return yargs.positional('folderpath', {
                describe: 'The local folder to push',
                type: 'string'
            });
          },
          async (argv) => {

            const { pinata, client } = await getRuntime();
            try{

              console.log(`\n⬆️ Starting PUSH operation on folder: ${argv.folderpath}`);
              gitBundler(argv.folderpath);
              await Push(argv.folderpath,pinata,client);
              console.log('Push operation finished.');

            }catch(e){
              console.log(String(e))
            }finally{
              await client.close()
            }


          }
        )
         .command(
          'pull <foldername>', 
          'Pulls the uploaded history into an existing project',
          (yargs) => {
            return yargs.positional('foldername', {
                describe: 'the repo/folder to pull',
                type: 'string'
            });
          },
          async (argv) => {

            const { pinata, client } = await getRuntime();
            try{

              console.log(`\n⬆️ Starting Pull operation`);
              await Pull(argv.foldername,pinata,client)
              

            }catch(e){
              console.log(String(e))
            }finally{
              await client.close()
            }


          }
        )
        .command(
          'clone <foldername>',
          'downloaded the repo, the foldername should not be full path but last base path like if we have C:\\Users\gooz\\OneDrive\\Desktop\\ihub , last base path here is ihub',
          (yargs) => {
            return yargs
              .positional('foldername', {
                describe: 'The folder to clone',
                type: 'string'
              })
              .option('new', { 
                alias: 'n',
                type: 'boolean',
                description: 'new repo or existing repo',
                default: false
            });
          },
          async (argv) => {
            
            const { pinata, client } = await getRuntime();
            try {
              console.log(`\n⬇️ Starting CLONE operation`);
              if(argv.new==true){
                await CloneNew(argv.foldername,pinata,client)
            
                } 
              else {
                await Clone(argv.foldername,pinata,client);
                console.log('Clone operation finished.');

              } 
            }
            catch(e){
                console.log(String(e))
            }
            finally{
              await client.close()
            }

          }
        )
        .demandCommand(1, 'You must provide a subcommand for "ihub" (login, push, or clone).')
        .help()
    }
  )
  .demandCommand(1, 'You must provide a top-level command like "ihub".')
  .usage('ihub <command> [options]')
  .example('ihub op login 0xABC...', 'Login using wallet address')
  .example('ihub op push ./repo', 'Push a local repository')
  .example('ihub op clone <reponame> --new true', 'Clone a new repository | name will be the reponame in UI')
  .example('ihub op clone <reponame>', 'Clone an existing repository | name will be the reponame in UI')
  .example('ihub op  pull <reponame>', 'Pul updates in an existing repository | name will be the reponame in UI')
  .epilog('ImmutableHub CLI • Built with ❤️')
  .help()
  .argv;





